const { createClient } = require("redis");

let client = null;
let connected = false;

function initRedis() {
  if (!process.env.REDIS_URL) return;

  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });

    client.on("error", (err) => {
      
      // Выключение спама на сервер об ошибке соединения с клиентом Redis
      if (connected) {
        console.warn("Redis connection error:", err.message);
      }
      connected = false;
    });

    client.on("ready", () => {
      console.log("Redis ready");
      connected = true;
    });

    client.connect().catch((err) => {
      console.warn("Redis initial connection failed:", err.message);
      connected = false;
    });
  }
}

function getRedisClient() {
  return connected ? client : null;
}

initRedis();

module.exports = getRedisClient;