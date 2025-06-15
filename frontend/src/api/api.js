// src/api/api.js
import axios from 'axios';

// Створюємо екземпляр axios з базовими налаштуваннями
const api = axios.create({
  // URL буде братися зі змінних середовища для продакшену (на Render)
  // або використовуватиме локальний URL для розробки.
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  withCredentials: true // Дуже важливо для роботи з JWT-токенами в http-only cookies
});

export default api;