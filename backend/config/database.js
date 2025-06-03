// backend/config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config(); // Load environment variables from .env
const logger = require('./logger'); // <--- IMPORT WINSTON LOGGER

// Create a new Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME,     // Database name
  process.env.DB_USER,     // Database username
  process.env.DB_PASSWORD, // Database password
  {
    host: process.env.DB_HOST, // Database host
    dialect: process.env.DB_DIALECT, // Database dialect (mysql)
    port: process.env.DB_PORT, // Database port
    // MODIFIED: Use Winston for Sequelize logging
    // Log Sequelize queries at 'debug' level if in development, otherwise false.
    logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false, 
  }
);

// Test the database connection
async function connectDB() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.'); // <--- USE LOGGER
  } catch (error) {
    logger.error('Unable to connect to the database:', { error: error.message, stack: error.stack }); // <--- USE LOGGER
    // process.exit(1); // Consider re-enabling for production if DB connection is critical at startup
  }
}

// connectDB(); // Not typically called here directly

module.exports = sequelize;