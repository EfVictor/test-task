const express = require("express");
const controllers = require("../controllers/Controller");             // Здесь описаны все контроллеры
const validateWriteOff = require("../middlewares/validateWriteOff");  // Мидлварка для валидации входных данных

const router = express.Router();

router.post("/writeOff", validateWriteOff, controllers.writeOff)   // Маршрут для списания/пополнения баланса пользователя
router.get("/Balance/:user_id", controllers.getBalance)            // Маршрут для получения баланса пользователя
router.get("/", controllers.emptyQuery)                            // Маршрут для пустого запроса

module.exports = router;