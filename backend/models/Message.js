const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Import the configured sequelize instance
const User = require('./User');     // Import the User model
const Listing = require('./Listing'); // Import the Listing model

// Define the Message model
const Message = sequelize.define('Message', {
  // Model attributes are defined here
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { // Define the foreign key relationship to User (sender)
      model: User,
      key: 'id'
    }
  },
  receiver_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { // Define the foreign key relationship to User (receiver)
      model: User,
      key: 'id'
    }
  },
  listing_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { // Define the foreign key relationship to Listing
      model: Listing,
      key: 'id'
    }
  }, is_read: { // <-- NEW FIELD
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT, // Use TEXT for message content
    allowNull: false
  },
  // Sequelize will add createdAt and updatedAt automatically because timestamps: true
}, {
  // Model options go here
  sequelize, // Pass the connection instance
  modelName: 'Message', // The model name
  tableName: 'messages', // Explicitly set the table name
  timestamps: true,      // Use default timestamps (createdAt and updatedAt)
  underscored: true      // Use snake_case for column names and foreign keys
});

// Define the associations:
// A Message belongs to a Sender User
Message.belongsTo(User, { as: 'Sender', foreignKey: 'sender_id' });
// A Message belongs to a Receiver User
Message.belongsTo(User, { as: 'Receiver', foreignKey: 'receiver_id' });
// A Message belongs to a Listing
Message.belongsTo(Listing, { foreignKey: 'listing_id' });


// Define inverse associations on the other models
// A User can have many Messages sent (with alias 'SentMessages')
User.hasMany(Message, { as: 'SentMessages', foreignKey: 'sender_id' });
// A User can have many Messages received (with alias 'ReceivedMessages')
User.hasMany(Message, { as: 'ReceivedMessages', foreignKey: 'receiver_id' });
// A Listing can have many Messages
Listing.hasMany(Message, { foreignKey: 'listing_id' });


module.exports = Message;