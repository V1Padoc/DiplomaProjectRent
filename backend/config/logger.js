// backend/config/logger.js
const winston = require('winston');
require('dotenv').config();

const { combine, timestamp, printf, colorize, align, json } = winston.format;

// Determine log level from environment or default to 'info'
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info');

// Custom print format for console
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (stack) {
    log += `\n${stack}`;
  }
  return log;
});

const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json() // Default format for files or other transports
  ),
  transports: [
    // For production, you might want to write to files or a logging service
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'combined.log' }),
  ],
  exceptionHandlers: [ // Handle uncaught exceptions
    // new winston.transports.File({ filename: 'exceptions.log' })
  ],
  rejectionHandlers: [ // Handle unhandled promise rejections
    // new winston.transports.File({ filename: 'rejections.log' })
  ],
});

// If not in production, add a console transport with colors and simpler format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      align(),
      consoleFormat
    ),
  }));
} else {
  // For production, console transport can be simpler or removed if logs go to files/services
  logger.add(new winston.transports.Console({
    format: combine(
        // In production, you might prefer JSON logs to console for easier parsing by log collectors
        // timestamp(), // Already in the main format
        // json()
        // Or a simple format if console is just for quick checks on the server
        consoleFormat // Using the same custom format as dev for consistency here
    ),
    // You might want to silence console in prod if logs are handled by files/services
    // silent: true 
  }));
  // Example: Add file transports for production
  logger.add(new winston.transports.File({
    filename: 'error.log',
    level: 'error',
    format: combine(timestamp(), json()), // JSON format for file logs
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true,
  }));
  logger.add(new winston.transports.File({
    filename: 'combined.log',
    format: combine(timestamp(), json()),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true,
  }));
}

// Stream interface for Morgan (HTTP request logger), if you use it
logger.stream = {
  write: (message) => {
    // Morgan typically includes a newline, remove it for cleaner logs with Winston
    logger.info(message.substring(0, message.lastIndexOf('\n')));
  },
};

module.exports = logger;