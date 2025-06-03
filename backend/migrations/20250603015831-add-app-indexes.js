'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addIndex('listings', ['status']);
    await queryInterface.addIndex('listings', ['type']);
    await queryInterface.addIndex('listings', ['price']);
    await queryInterface.addIndex('listings', ['created_at']);
    // For location with LIKE '%value%', a standard index has limited use.
    // If you search location with LIKE 'value%', it's more helpful.
    // await queryInterface.addIndex('listings', ['location']); // Optional

    await queryInterface.addIndex('bookings', ['status']);
    await queryInterface.addIndex('bookings', ['is_update_seen_by_tenant']);
    // Composite index for booking conflict checks and fetching by status
    await queryInterface.addIndex('bookings', ['listing_id', 'status', 'start_date', 'end_date'], {
      name: 'bookings_listing_status_dates_idx'
    });

    await queryInterface.addIndex('messages', ['is_read']);
    await queryInterface.addIndex('messages', ['created_at']);
    // Composite index for unread counts by receiver
    await queryInterface.addIndex('messages', ['receiver_id', 'is_read'], {
      name: 'messages_receiver_read_status_idx'
    });
     // Composite index for marking messages as read in a specific chat
    await queryInterface.addIndex('messages', ['listing_id', 'receiver_id', 'sender_id', 'is_read'], {
      name: 'messages_chat_read_status_idx'
    });


    await queryInterface.addIndex('users', ['role']); // If you query users by role often
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('listings', ['status']);
    await queryInterface.removeIndex('listings', ['type']);
    await queryInterface.removeIndex('listings', ['price']);
    await queryInterface.removeIndex('listings', ['created_at']);
    // await queryInterface.removeIndex('listings', ['location']);

    await queryInterface.removeIndex('bookings', ['status']);
    await queryInterface.removeIndex('bookings', ['is_update_seen_by_tenant']);
    await queryInterface.removeIndex('bookings', 'bookings_listing_status_dates_idx');

    await queryInterface.removeIndex('messages', ['is_read']);
    await queryInterface.removeIndex('messages', ['created_at']);
    await queryInterface.removeIndex('messages', 'messages_receiver_read_status_idx');
    await queryInterface.removeIndex('messages', 'messages_chat_read_status_idx');

    await queryInterface.removeIndex('users', ['role']);
  }
};