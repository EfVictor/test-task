require("dotenv").config();
const express = require("express");
const routes = require("./routes/Routes.js");  // Здесь описаны все маршруты

const app = express();
app.use(express.json());

app.use("", routes);

app.listen(process.env.PORT, () => {
    console.log(`Сервер запущен на порту ${process.env.PORT}`);
}).on('error', (err) => {
  console.error("Ошибка при запуске сервера: ", err);
});