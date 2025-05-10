const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Import the configured sequelize instance
const Listing = require('./Listing'); // Import the Listing model
const User = require('./User');     // Import the User model

// Define the Review model
const Review = sequelize.define('Review', {
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
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { // Define the foreign key relationship to User
      model: User,
      key: 'id'
    }
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1, // Minimum rating is 1
      max: 5  // Maximum rating is 5
    }
  },
  comment: {
    type: DataTypes.TEXT, // Use TEXT for the review comment
    allowNull: true      // Comment can be optional, just providing a rating is allowed
  },
  // Sequelize will add createdAt and updatedAt automatically because timestamps: true
}, {
  // Model options go here
  sequelize, // Pass the connection instance
  modelName: 'Review', // The model name
  tableName: 'reviews', // Explicitly set the table name
  timestamps: true,      // Use default timestamps (createdAt and updatedAt)
  underscored: true      // Use snake_case for column names and foreign keys
});

// Define the associations:
// A Review belongs to a Listing
Review.belongsTo(Listing, { foreignKey: 'listing_id' });
// A Review belongs to a User (the reviewer)
Review.belongsTo(User, { foreignKey: 'user_id' });

// Define inverse associations on the other models
// A Listing can have many Reviews
Listing.hasMany(Review, { foreignKey: 'listing_id' });
// A User can leave many Reviews
User.hasMany(Review, { foreignKey: 'user_id' });


module.exports = Review;