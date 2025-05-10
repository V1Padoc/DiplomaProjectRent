const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Import the configured sequelize instance
const User = require('./User'); // Import the User model to define the relationship

// Define the Listing model
const Listing = sequelize.define('Listing', {
  // Model attributes are defined here
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { // Define the foreign key relationship
      model: User, // Reference the User model
      key: 'id'    // Use the 'id' column of the User model
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT, // Use TEXT for potentially longer descriptions
    allowNull: true      // Description can be optional
  },
  price: {
    type: DataTypes.DECIMAL(10, 2), // Use DECIMAL for monetary values (total 10 digits, 2 after decimal)
    allowNull: false,
    validate: {
      isDecimal: true,
      min: 0 // Price should be non-negative
    }
  },
  rooms: {
    type: DataTypes.INTEGER,
    allowNull: true, // Number of rooms can be optional
    validate: {
      isInt: true,
      min: 0
    }
  },
  area: {
    type: DataTypes.DECIMAL(10, 2), // Area (e.g., in sq ft or sq meters)
    allowNull: true,
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  location: {
    // This could be a simple string address, or more complex geo data
    type: DataTypes.STRING,
    allowNull: false // Location is essential
    // You might want to split this into city, address, zip, lat, lon later
    // For now, let's keep it simple as a string
  },
  amenities: {
    // Store amenities as a JSON string or text, or link to a separate Amenities table later
    type: DataTypes.TEXT, // Store as text, perhaps a comma-separated list or JSON string
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('rent', 'sale'), // Restrict values to 'rent' or 'sale'
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'rejected', 'archived'), // Listing status
    allowNull: false,
    defaultValue: 'pending' // Listings start as pending until admin approves
  },
  // Sequelize will add createdAt and updatedAt automatically because timestamps: true
  // If you want to store photo file paths, you might add:
  // photos: {
  //   type: DataTypes.JSON, // Store an array of photo paths as JSON
  //   allowNull: true
  // }
  // We'll handle photo paths when we implement the listing creation API.
}, {
  // Model options go here
  sequelize, // Pass the connection instance
  modelName: 'Listing', // The model name
  tableName: 'listings', // Explicitly set the table name
  timestamps: true,      // Use default timestamps (createdAt and updatedAt)
  underscored: true      // Use snake_case for column names
});

// Define the association: A Listing belongs to a User (the owner)
Listing.belongsTo(User, { foreignKey: 'owner_id' });
// Conversely, a User can have many Listings
User.hasMany(Listing, { foreignKey: 'owner_id' });


module.exports = Listing;