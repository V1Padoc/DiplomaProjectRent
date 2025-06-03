// backend/config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config(); // Load environment variables from .env

// Create a new Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME,     // Database name
  process.env.DB_USER,     // Database username
  process.env.DB_PASSWORD, // Database password
  {
    host: process.env.DB_HOST, // Database host
    dialect: process.env.DB_DIALECT, // Database dialect (mysql)
    port: process.env.DB_PORT, // Database port
    // MODIFIED: Conditional logging based on NODE_ENV
    logging: process.env.NODE_ENV === 'development' ? console.log : false, // Log in dev, disable in prod
  }
);

// Test the database connection
async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    // process.exit(1); // Consider re-enabling for production if DB connection is critical at startup
  }
}

// connectDB(); // Call if you want to test connection immediately on module load

module.exports = sequelize;