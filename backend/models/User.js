const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Import the configured sequelize instance

// Define the User model
const User = sequelize.define('User', {
  // Model attributes are defined here
  id: {
    type: DataTypes.INTEGER, // Integer type
    autoIncrement: true,    // Automatically increases for each new user
    primaryKey: true,       // This is the unique identifier for each user
    allowNull: false        // This field cannot be empty
  },
  email: {
    type: DataTypes.STRING, // String type
    allowNull: false,       // Cannot be empty
    unique: true,           // Each email must be unique (no duplicate accounts)
    validate: {
      isEmail: true         // Sequelize will validate if it's a valid email format
    }
  },
  password: {
    type: DataTypes.STRING, // String type (will store the hashed password)
    allowNull: false        // Cannot be empty
  },
  role: {
    type: DataTypes.ENUM('tenant', 'owner', 'admin'), // Restrict values to these options
    allowNull: false,
    defaultValue: 'tenant' // Default role if not specified
  },
  name: {
    type: DataTypes.STRING, // String type
    allowNull: true         // Can be empty initially, users can add later
  },
   profile_photo_url: { // Store the path/filename of the profile photo
    type: DataTypes.STRING,
    allowNull: true,
  },
  bio: { // User's description/bio
    type: DataTypes.TEXT,
    allowNull: true,
  },
  phone_number: {
    type: DataTypes.STRING, // Store as string to accommodate various formats, country codes
    allowNull: true,
  }
  // Sequelize automatically adds `createdAt` and `updatedAt` timestamps by default.
  // We only need `created_at` according to the schema, but letting Sequelize manage both is common and often useful.
  // If you strictly only want `created_at`, you can disable default timestamps and add it manually:
  // created_at: {
  //   type: DataTypes.DATE,
  //   defaultValue: DataTypes.NOW,
  //   allowNull: false
  // }
  // For now, let's stick with Sequelize's default timestamps which cover both.
}, {
  // Model options go here
  tableName: 'users', // Explicitly set the table name to 'users'
  timestamps: true,   // Use default timestamps (createdAt and updatedAt)
  underscored: true   // Use snake_case for column names (e.g., created_at instead of createdAt)
});

// `sequelize.define` returns the model class itself
module.exports = User;