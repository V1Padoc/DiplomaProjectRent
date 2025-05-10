const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Import the configured sequelize instance
const Listing = require('./Listing'); // Import the Listing model

// Define the Analytics model
const Analytics = sequelize.define('Analytics', {
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
  views_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0, // Start views count at 0
    validate: {
      isInt: true,
      min: 0
    }
  },
  // According to your schema, we only need `created_at`, not `updated_at`.
  created_at: {
     type: DataTypes.DATE,
     defaultValue: DataTypes.NOW,
     allowNull: false
  }
}, {
  // Model options go here
  sequelize, // Pass the connection instance
  modelName: 'Analytics', // The model name
  tableName: 'analytics', // Explicitly set the table name
  timestamps: false,     // Disable default timestamps (createdAt and updatedAt)
  underscored: true      // Use snake_case for column names and foreign keys
});

// Define the association:
// An Analytics entry belongs to a Listing
Analytics.belongsTo(Listing, { foreignKey: 'listing_id' });

// Define inverse association on the Listing model
// A Listing can have many Analytics entries (though for views, we might often aggregate them)
// Keeping this association is still useful for historical view data or future features.
Listing.hasMany(Analytics, { foreignKey: 'listing_id' });


module.exports = Analytics;