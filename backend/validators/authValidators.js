// backend/validators/authValidators.js
const { body, validationResult } = require('express-validator');

exports.registerValidationRules = () => {
  return [
    body('email')
      .isEmail().withMessage('Must be a valid email address.')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
    body('name')
      .notEmpty().withMessage('First name is required.')
      .trim()
      .escape(),
    body('last_name')
      .notEmpty().withMessage('Last name is required.')
      .trim()
      .escape(),
    body('phone_number')
      .notEmpty().withMessage('Phone number is required.')
      .isMobilePhone('any', { strictMode: false }).withMessage('Must be a valid phone number.') // General phone validation
      .trim(),
    body('role')
      .isIn(['tenant', 'owner']).withMessage('Invalid role specified.'),
  ];
};

exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ [err.path]: err.msg })); // 'path' instead of 'param' for newer versions

  return res.status(422).json({
    message: 'Validation failed, entered data is incorrect.', // General message
    errors: extractedErrors,
  });
};