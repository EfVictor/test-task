// Unit тесты
jest.mock("../config/db");
jest.mock("../config/redis");

const Controller = require("../controllers/Controller");
const pool = require("../config/db");
const getRedisClient = require("../config/redis");

const res = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn()
});

describe("Controller", () => {

  afterEach(() => jest.clearAllMocks());

  // Получение баланса из кэша Redis
  test("getBalance → из Redis", async () => {
    getRedisClient.mockReturnValue({
      get: jest.fn().mockResolvedValue("5000")
    });

    const r = res();
    await Controller.getBalance({ params: { user_id: "1" } }, r);

    expect(r.json).toHaveBeenCalledWith({
      status: "OK",
      user_id: "1",
      balance: "50.00",
      source: "cache"
    });
  });

  // Получение баланса напрямую из PostgreeSQL
  test("getBalance → из БД", async () => {
    getRedisClient.mockReturnValue(null);
    pool.query.mockResolvedValue({ rowCount: 1, rows: [{ balance: "10000" }] });

    const r = res();
    await Controller.getBalance({ params: { user_id: "1" } }, r);

    expect(r.json).toHaveBeenCalledWith({
      status: "OK",
      user_id: "1",
      balance: "100.00",
      source: "db"
    });
  });

  // Успешное списание средств
  test("writeOff → успешное списание", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ balance: "10000" }] })
        .mockResolvedValueOnce() // INSERT history
        .mockResolvedValueOnce({ rows: [{ balance: "0" }] }) // SELECT SUM
        .mockResolvedValueOnce() // UPDATE
        .mockResolvedValueOnce(), // COMMIT
      release: jest.fn()
    };

    pool.connect.mockResolvedValue(client);
    getRedisClient.mockReturnValue(null);

    const r = res();
    await Controller.writeOff(
      { body: { user_id: 1, amount: 100, action: "PAYMENT" } },
      r
    );

    expect(r.json).toHaveBeenCalledWith({
      status: "OK",
      balance_before: "100.00",
      balance_after: "0.00"
    });
  });

  // Списание средств при недостаточном балансе
  test("writeOff → недостаточно средств", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ balance: "5000" }] })
        .mockResolvedValueOnce() // INSERT history
        .mockResolvedValueOnce({ rows: [{ balance: "-5000" }] }) // SELECT SUM
        .mockResolvedValueOnce(), // ROLLBACK
      release: jest.fn()
    };

    pool.connect.mockResolvedValue(client);

    const r = res();
    await Controller.writeOff(
      { body: { user_id: 1, amount: 100, action: "PAYMENT" } },
      r
    );

    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json).toHaveBeenCalledWith({ error: "Недостаточно средств" });
  });

});