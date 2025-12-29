const pool = require("../config/db");
const getRedisClient = require("../config/redis");

// Контроллер для получения баланса пользователя
exports.getBalance = async (req, res) => {
  const { user_id } = req.params;
  let balance;
  let source = "db"; // Для указания откуда получен баланс - из кэша Redis или напрямую из PostgreSQL

  try {
    // Если клиент Redis существует - получение баланса из него
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const cached = await redisClient.get(`user:balance:${user_id}`);
        if (cached !== null) {
          balance = BigInt(cached);
          source = "cache";
        }
      } catch (err) {
        console.warn("Запрос GET к Redis завершился неудачей, используется база данных PostgreSQL:", err.message);
      }
    }

    // Если баланс не получили из кэша Redis, то берём из PostgreSQL
    if (balance === undefined) {
      const result = await pool.query(
        "SELECT balance FROM users WHERE id = $1",
        [user_id]
      );

      // Если баланс не найден - возврат ошибки
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      balance = BigInt(result.rows[0].balance);

      // Если клиент Redis доступен - запись баланса в кэш
      if (redisClient) {
        try {
          await redisClient.set(`user:balance:${user_id}`, balance.toString(), { EX: 60 });
        } catch (err) {
          console.warn("Команда Redis SET завершилась неудачей:", err.message);
        }
      }
    }

    // Преобразование баланса в "человеческий вид" в долларах, а не центах
    const humanBalance = (Number(balance) / 100).toFixed(2);

    // Возврат ответа клиенту
    res.status(200).json({
      status: "OK",
      user_id,
      balance: humanBalance,
      source
    });
  } catch (err) {
    console.error("Ошибка при получении баланса:", err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
}

// Контроллер для списания/пополнения баланса пользователя
exports.writeOff = async (req, res) => {
  const { user_id, amount, action } = req.body;

  // Преобразование входящей суммы в целые единицы (центы)
  if (typeof amount !== "number") {
    return res.status(400).json({ error: "Сумма должна быть числом." });
  }
  const amountInCents = BigInt(Math.round(amount * 100));

  // Работа с базой данных
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Блокировка строки пользователя
    const userRes = await client.query(
      "SELECT balance FROM users WHERE id = $1 FOR UPDATE",
      [user_id]
    );

    // Если пользователь не найден - возврат ошибки
    if (userRes.rowCount === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    const balanceBefore = BigInt(userRes.rows[0].balance);

    // Определение знака операции (списание(-)/пополнение(+))
    const delta =
      action === "DEPOSIT"
        ? amountInCents
        : action === "PAYMENT"
          ? -amountInCents
          : null;

    // Если тип операции не определен - возврат ошибки
    if (delta === null) {
      throw new Error("UNKNOWN_ACTION");
    }

    // Запись истории совершения операции
    await client.query(
      `INSERT INTO balance_history (user_id, action, amount) VALUES ($1, $2, $3)`,
      [user_id, action, amountInCents.toString()]
    );

    // Пересчет баланса по истории
    const balanceRes = await client.query(
      `SELECT COALESCE(SUM(
        CASE
          WHEN action = 'DEPOSIT' THEN amount
          WHEN action = 'PAYMENT' THEN -amount
          ELSE 0
        END), 0) AS balance
      FROM balance_history
      WHERE user_id = $1`,
      [user_id]
    );

    const newBalance = BigInt(balanceRes.rows[0].balance);

    // Проверка баланса
    if (newBalance < 0n) {
      throw new Error("INSUFFICIENT_FUNDS");
    }

    // Обновление баланса у пользователя
    await client.query(
      "UPDATE users SET balance = $1 WHERE id = $2",
      [newBalance.toString(), user_id]
    );

    await client.query("COMMIT");

    // Запись кэша в Redis
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        await redisClient.set(`user:balance:${user_id}`, newBalance.toString(), { EX: 60 });
      } catch (err) {
        console.warn("Команда Redis SET завершилась неудачей:", err.message);
      }
    }

    // Возврат ответа клиенту
    res.status(200).json({
      status: "OK",
      balance_before: (Number(balanceBefore) / 100).toFixed(2),
      balance_after: (Number(newBalance) / 100).toFixed(2)
    });
  } catch (err) {
      await client.query("ROLLBACK");

      if (err.message === "USER_NOT_FOUND") {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      if (err.message === "INSUFFICIENT_FUNDS") {
        return res.status(400).json({ error: "Недостаточно средств" });
      }

      if (err.message === "UNKNOWN_ACTION") {
        return res.status(400).json({ error: "Неизвестная операция" });
      }

      console.error(err);
      res.status(500).json({ error: "Внутренняя ошибка сервера" });
  } finally {
      client.release();
  }
};

// Контроллер для пустого запроса. В данном случае HEALTH CHECK
exports.emptyQuery = async (req, res) => {
  res.status(200).json({
      status: "ОК",
      message: "Версия сервиса: 1.0"
  });
};