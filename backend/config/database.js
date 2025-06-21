// backend/config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

// Перевіряємо, чи ми в середовищі Render (де є DATABASE_URL)
if (process.env.DATABASE_URL) {
  // Використовуємо DATABASE_URL для продакшену
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres', // Діалект для продакшену
    protocol: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  });
} else {
  // Використовуємо налаштування для локальної розробки з .env
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      dialect: 'postgres', // <-- Змінено на 'postgres' для локальної розробки
      port: process.env.DB_PORT,
      logging: console.log
    }
  );
}

// Функція для перевірки з'єднання
async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

connectDB();

module.exports = sequelize;