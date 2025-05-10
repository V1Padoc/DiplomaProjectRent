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
    logging: console.log, // Set to true to see SQL queries in the console (useful for debugging)
  }
);

// Test the database connection
async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    // In a real app, you might want to exit the process here
    // process.exit(1);
  }
}

// Call the connection function immediately (optional, but good for testing)
// connectDB();

module.exports = sequelize; // Export the configured sequelize instance