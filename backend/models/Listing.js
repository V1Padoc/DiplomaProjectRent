const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Listing = sequelize.define('Listing', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  rooms: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      isInt: true,
      min: 0
    }
  },
  area: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amenities: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('monthly-rental', 'daily-rental'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'rejected', 'archived'),
    allowNull: false,
    defaultValue: 'pending'
  },
  photos: {
    type: DataTypes.JSONB, // <-- ЗМІНЕНО з DataTypes.JSON на DataTypes.JSONB для кращої продуктивності в Postgres
    allowNull: true
  },
   latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true
  },
}, {
  sequelize,
  modelName: 'Listing',
  tableName: 'listings',
  timestamps: true,
  underscored: true
});

Listing.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });
User.hasMany(Listing, { foreignKey: 'owner_id', as: 'Listings' });

module.exports = Listing;