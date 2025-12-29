const express = require("express");
const сontrollers = require("../controllers/Controller");             // Здесь описаны все контроллеры
const validateWriteOff = require("../middlewares/validateWriteOff");  // Мидлварка для валидации входных данных

const router = express.Router();

router.post("/writeOff", validateWriteOff, сontrollers.writeOff)   // Маршрут для списания/пополнения баланса пользователя
router.get("/Balance/:user_id", сontrollers.getBalance)         // Маршрут для получения баланса пользователя
router.get("/", сontrollers.emptyQuery)                            // Маршрут для пустого запроса

module.exports = router;