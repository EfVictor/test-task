// Валидация данных на вход
const Ajv = require("ajv");
const schema = require("../validators/writeOff.schema");

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

module.exports = (req, res, next) => {
  const valid = validate(req.body);

  if (!valid) {
    return res.status(400).json({
      error: "Validation error",
      details: validate.errors
    });
  }

  next();
};