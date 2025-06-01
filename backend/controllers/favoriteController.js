// backend/controllers/favoriteController.js
const Favorite = require('../models/Favorite');
const Listing = require('../models/Listing');
const User = require('../models/User'); // For including Owner in listing details
const { Op } = require('sequelize');

exports.addFavorite = async (req, res) => {
    const userId = req.user.id;
    const { listingId } = req.params;
    try {
        const listingExists = await Listing.findByPk(listingId);
        if (!listingExists) return res.status(404).json({ message: "Listing not found." });

        const [favorite, created] = await Favorite.findOrCreate({
            where: { user_id: userId, listing_id: listingId },
            defaults: { user_id: userId, listing_id: listingId }
        });
        if (!created) return res.status(409).json({ message: "Listing already favorited." });
        res.status(201).json({ message: "Listing added to favorites.", favorite });
    } catch (error) {
        console.error("Error adding favorite:", error);
        res.status(500).json({ message: "Server error while adding favorite." });
    }
};

exports.removeFavorite = async (req, res) => {
    const userId = req.user.id;
    const { listingId } = req.params;
    try {
        const result = await Favorite.destroy({
            where: { user_id: userId, listing_id: listingId }
        });
        if (result === 0) return res.status(404).json({ message: "Favorite not found." });
        res.status(200).json({ message: "Listing removed from favorites." });
    } catch (error) {
        console.error("Error removing favorite:", error);
        res.status(500).json({ message: "Server error while removing favorite." });
    }
};

exports.getMyFavorites = async (req, res) => {
    const userId = req.user.id;
    try {
        const userFavorites = await Favorite.findAll({
            where: { user_id: userId },
            attributes: ['listing_id']
        });

        if (!userFavorites.length) {
            return res.status(200).json([]); // No favorites
        }

        const favoriteListingIds = userFavorites.map(fav => fav.listing_id);

        const listings = await Listing.findAll({
            where: {
                id: { [Op.in]: favoriteListingIds },
                status: 'active' // Or whatever statuses you want to show
            },
            include: [ // Include necessary associations for display
                { model: User, as: 'Owner', attributes: ['id', 'name', 'email'] },
                // Add other includes like Photos if your Favorite page card needs them
            ],
            order: [['created_at', 'DESC']]
        });

        res.status(200).json(listings);
    } catch (error) {
        console.error("Error fetching user's favorited listings:", error);
        res.status(500).json({ message: "Server error while fetching favorites." });
    }
};

exports.getMyFavoriteIds = async (req, res) => {
    const userId = req.user.id;
    try {
        const favorites = await Favorite.findAll({
            where: { user_id: userId },
            attributes: ['listing_id']
        });
        const favorite_ids = favorites.map(f => f.listing_id);
        res.status(200).json({ favorite_ids });
    } catch (error) {
        console.error("Error fetching favorite IDs:", error);
        res.status(500).json({ message: "Server error." });
    }
};