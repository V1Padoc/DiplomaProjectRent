const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Import the configured sequelize instance
const Listing = require('./Listing'); // Import the Listing model
const User = require('./User');     // Import the User model

// Define the Booking model
const Booking = sequelize.define('Booking', {
  // Model attributes are defined here
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  listing_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { // Define the foreign key relationship to Listing
      model: Listing,
      key: 'id'
    }
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { // Define the foreign key relationship to User (tenant)
      model: User,
      key: 'id'
    }
  },
  start_date: {
    type: DataTypes.DATE, // Use DATE type for dates
    allowNull: false
  },
  end_date: {
    type: DataTypes.DATE, // Use DATE type for dates
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'rejected'), // Possible booking statuses
    allowNull: false,
    defaultValue: 'pending' // New bookings start as pending
  },
  // Sequelize will add createdAt and updatedAt automatically because timestamps: true
}, {
  // Model options go here
  sequelize, // Pass the connection instance
  modelName: 'Booking', // The model name
  tableName: 'bookings', // Explicitly set the table name
  timestamps: true,      // Use default timestamps (createdAt and updatedAt)
  underscored: true      // Use snake_case for column names and foreign keys
});

// Define the associations:
// A Booking belongs to a Listing
Booking.belongsTo(Listing, { foreignKey: 'listing_id' });
// A Booking belongs to a User (the tenant)
Booking.belongsTo(User, { foreignKey: 'tenant_id' });

// Define inverse associations on the other models (Good Practice)
// A Listing can have many Bookings
Listing.hasMany(Booking, { foreignKey: 'listing_id' });
// A User can have many Bookings (as a tenant)
User.hasMany(Booking, { foreignKey: 'tenant_id' });


module.exports = Booking;