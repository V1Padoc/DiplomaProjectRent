// backend/config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

// Перевіряємо, чи ми в середовищі Render/Heroku (де є DATABASE_URL)
if (process.env.DATABASE_URL) {
  // Використовуємо DATABASE_URL для продакшену
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres', // На Render за замовчуванням PostgreSQL
    protocol: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Це критично важливо для підключення до баз Render
      }
    },
    logging: false // Відключаємо логування в продакшені
  });
} else {
  // Використовуємо ваші старі налаштування для локальної розробки
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      dialect: process.env.DB_DIALECT || 'mysql', // Ваш локальний діалект (ймовірно, mysql)
      port: process.env.DB_PORT,
      logging: console.log // Включаємо логування для розробки
    }
  );
}

// Функція для перевірки з'єднання залишається такою ж
async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

connectDB(); // Можна викликати для перевірки при запуску

module.exports = sequelize;