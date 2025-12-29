// Схема валидации данных на вход
module.exports = {
  type: "object",
  properties: {
    user_id: {
      type: "integer",
      minimum: 1
    },
    amount: {
      type: "number",
      minimum: 0.1 // 1 цент
    },
    action: {
      type: "string",
      enum: ["DEPOSIT", "PAYMENT"] // Для определения знака операции. DEPOSIT: "+" PAYMENT "-"
    }
  },
  required: ["user_id", "amount", "action"],
  additionalProperties: false
};