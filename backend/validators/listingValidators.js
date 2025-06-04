// backend/validators/listingValidators.js
const { body, query, param, validationResult } = require('express-validator');

// Reusable validation error handler (can be moved to a shared utils if used by many validators)
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

exports.createListingValidationRules = () => {
  return [
    body('title')
      .notEmpty().withMessage('Title is required.')
      .isString().withMessage('Title must be a string.')
      .trim()
      .isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters.'),
    body('description')
      .optional({ checkFalsy: true }) // Allows empty string or null
      .isString().withMessage('Description must be a string.')
      .trim()
      .isLength({ max: 5000 }).withMessage('Description cannot exceed 5000 characters.'),
    body('price')
      .notEmpty().withMessage('Price is required.')
      .isFloat({ gt: 0 }).withMessage('Price must be a positive number.'),
    body('rooms')
      .optional({ checkFalsy: true })
      .isInt({ min: 0 }).withMessage('Rooms must be a non-negative integer.'),
    body('area')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 }).withMessage('Area must be a non-negative number.'),
    body('location')
      .notEmpty().withMessage('Location is required.')
      .isString().withMessage('Location must be a string.')
      .trim()
      .isLength({ min: 3, max: 255 }).withMessage('Location must be between 3 and 255 characters.'),
    body('latitude')
      .optional({ checkFalsy: true })
      .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude value.'),
    body('longitude')
      .optional({ checkFalsy: true })
      .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude value.'),
    body('amenities')
      .optional({ checkFalsy: true })
      .isString().withMessage('Amenities must be a string.')
      .trim(),
    body('type')
      .notEmpty().withMessage('Listing type is required.')
      .isIn(['monthly-rental', 'daily-rental']).withMessage('Invalid listing type.'),
    // Note: 'photos' are handled by multer, so direct validation here is tricky.
    // We validate file types and size in multerConfig.
    // We can check `req.files` count if needed after multer.
  ];
};

exports.updateListingValidationRules = () => {
  // Similar to create, but most fields are optional for updates
  // Add param validation for the listing ID
  return [
    param('id').isInt({ min: 1 }).withMessage('Listing ID must be a valid integer.'),
    body('title')
      .optional()
      .isString().withMessage('Title must be a string.')
      .trim()
      .isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters.'),
    body('description')
      .optional({ checkFalsy: true })
      .isString().withMessage('Description must be a string.')
      .trim()
      .isLength({ max: 5000 }).withMessage('Description cannot exceed 5000 characters.'),
    body('price')
      .optional()
      .isFloat({ gt: 0 }).withMessage('Price must be a positive number.'),
    body('rooms')
      .optional({ checkFalsy: true }) // Allows empty string to be converted to null later
      .custom((value) => { // Custom validator to allow empty string or valid integer
        if (value === '' || value === null || value === undefined) return true;
        return Number.isInteger(Number(value)) && Number(value) >= 0;
      }).withMessage('Rooms must be a non-negative integer or empty.'),
    body('area')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (value === '' || value === null || value === undefined) return true;
        return !isNaN(parseFloat(value)) && parseFloat(value) >= 0;
      }).withMessage('Area must be a non-negative number or empty.'),
    body('location')
      .optional()
      .isString().withMessage('Location must be a string.')
      .trim()
      .isLength({ min: 3, max: 255 }).withMessage('Location must be between 3 and 255 characters.'),
    body('latitude')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (value === '' || value === null || value === undefined) return true;
        return !isNaN(parseFloat(value)) && parseFloat(value) >= -90 && parseFloat(value) <= 90;
      }).withMessage('Invalid latitude value or empty.'),
    body('longitude')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (value === '' || value === null || value === undefined) return true;
        return !isNaN(parseFloat(value)) && parseFloat(value) >= -180 && parseFloat(value) <= 180;
      }).withMessage('Invalid longitude value or empty.'),
    body('amenities')
      .optional({ checkFalsy: true })
      .isString().withMessage('Amenities must be a string.')
      .trim(),
    body('type')
      .optional()
      .isIn(['monthly-rental', 'daily-rental']).withMessage('Invalid listing type.'),
    body('status') // For admin updates via this route
      .optional()
      .isIn(['pending', 'active', 'rejected', 'archived']).withMessage('Invalid status for update.'),
    // photoManifest will be a JSON string
    body('photoManifest')
      .optional()
      .isJSON().withMessage('Photo manifest must be a valid JSON string.'),
  ];
};

exports.validateListingId = () => [
  // Make param('id') optional so it doesn't fail if the route uses :listingId instead
  param('id').optional().isInt({ min: 1 }).withMessage('Listing ID must be a valid integer.'),
  param('listingId').optional().isInt({ min: 1 }).withMessage('Listing ID must be a valid integer.') // For routes like /:listingId/reviews
];



exports.validate = validate; // Export the shared handler