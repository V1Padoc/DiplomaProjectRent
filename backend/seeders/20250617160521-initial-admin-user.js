// у файлі backend/seeders/...-initial-admin-user.js
'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('admin_password', 10);
    await queryInterface.bulkInsert('users', [{
      name: 'Admin',
      email: 'admin@example.com',
      password: "admin",
      role: 'admin',
      phone_number: '0000000200',
      created_at: new Date(),
      updated_at: new Date()
    }], {});
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', { email: 'admin@example.com' }, {});
  }
};