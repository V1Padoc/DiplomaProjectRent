// backend/middleware/errorHandler.js
const logger = require('../config/logger');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { 
    path: req.path, 
    method: req.method, 
    error: err.message, 
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined, // Show stack only in dev
    // You might want to log err.errors if it's a validation error from Sequelize or custom
    validationErrors: err.errors ? err.errors : undefined 
  });

  // Default status code and message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific error types for more user-friendly messages
  if (err.name === 'SequelizeValidationError') {
    statusCode = 422; // Unprocessable Entity
    message = 'Validation Failed';
    // Optionally, include specific validation error messages
    // const errors = err.errors.map(e => ({ field: e.path, message: e.message }));
    // return res.status(statusCode).json({ message, errors });
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409; // Conflict
    message = 'Duplicate entry. A record with this value already exists.';
    // Optionally, parse specific field from error for better message
    // const field = err.errors && err.errors.length > 0 ? err.errors[0].path : 'field';
    // message = `The value for ${field} is already in use.`;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401; // Unauthorized
    message = 'Invalid or expired token. Please log in again.';
  }
  // Add more specific error checks as needed (e.g., for custom error classes)

  // Ensure a message is always sent
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred. Please try again later.';
  }

  res.status(statusCode).json({
    message: message,
    // Optionally, include error details in development
    ...(process.env.NODE_ENV === 'development' && { errorDetails: err.stack }),
  });
};

module.exports = errorHandler;