const { validationResult } = require('express-validator');
const ApiError = require('../utils/apiError');

const validate = (validations) => {
  return async (req, res, next) => {
    if (Array.isArray(validations)) {
      for (let validation of validations) {
        const result = await validation.run(req);
        if (result.errors.length) break;
      }
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg
    }));

    throw new ApiError(400, 'Validation failed for request payload', extractedErrors);
  };
};

module.exports = validate;
