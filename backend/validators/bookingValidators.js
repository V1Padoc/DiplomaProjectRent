// backend/validators/bookingValidators.js
const { body, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));
  return res.status(422).json({
    message: 'Validation failed, entered data is incorrect.',
    errors: extractedErrors,
  });
};

exports.createBookingValidationRules = () => {
  return [
    body('listing_id')
      .notEmpty().withMessage('Listing ID is required.')
      .isInt({ min: 1 }).withMessage('Invalid Listing ID.'),
    body('start_date')
      .notEmpty().withMessage('Start date is required.')
      .isISO8601().withMessage('Start date must be a valid date (YYYY-MM-DD).')
      .toDate(), // Converts to JavaScript Date object
    body('end_date')
      .notEmpty().withMessage('End date is required.')
      .isISO8601().withMessage('End date must be a valid date (YYYY-MM-DD).')
      .toDate()
      .custom((endDate, { req }) => {
        if (req.body.start_date && endDate <= req.body.start_date) {
          throw new Error('End date must be after start date.');
        }
        return true;
      }),
  ];
};

exports.updateBookingStatusValidationRules = () => {
  return [
    param('bookingId')
      .isInt({ min: 1 }).withMessage('Booking ID must be a valid integer.'),
    body('status')
      .notEmpty().withMessage('Status is required.')
      .isIn(['confirmed', 'rejected']).withMessage("Invalid status. Must be 'confirmed' or 'rejected'."),
  ];
};

exports.validate = validate;