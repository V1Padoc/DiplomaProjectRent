// backend/models/Favorite.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Listing = require('./Listing');

const Favorite = sequelize.define('Favorite', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: User, key: 'id' }
    },
    listing_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: Listing, key: 'id' }
    }
}, {
    tableName: 'favorites',
    timestamps: true, // Adds createdAt and updatedAt
    underscored: true,
    indexes: [ // Ensure user cannot favorite the same listing multiple times
        { unique: true, fields: ['user_id', 'listing_id'] }
    ]
});

User.belongsToMany(Listing, { through: Favorite, foreignKey: 'user_id', as: 'FavoritedListings' });
Listing.belongsToMany(User, { through: Favorite, foreignKey: 'listing_id', as: 'FavoritedByUsers' });

Favorite.belongsTo(User, { foreignKey: 'user_id' });
Favorite.belongsTo(Listing, { foreignKey: 'listing_id' });

module.exports = Favorite;