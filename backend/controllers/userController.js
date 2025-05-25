// backend/controllers/userController.js
const User = require('../models/User');
const Listing = require('../models/Listing'); // To fetch user's listings
const Review = require('../models/Review');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs'); 

// PUT /api/users/profile - Update current user's profile
exports.updateUserProfile = async (req, res) => {
    const userId = req.user.id; // From authMiddleware
    const { name, bio, phone_number } = req.body;

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Prepare fields to update
        const fieldsToUpdate = {};
        if (name !== undefined) fieldsToUpdate.name = name;
        if (bio !== undefined) fieldsToUpdate.bio = bio;
        if (phone_number !== undefined) fieldsToUpdate.phone_number = phone_number;
        if (phone_number !== undefined) {
        // *** ADDED: Validation if phone_number is being set/updated and is empty ***
        if (phone_number === '') { // If they try to clear a mandatory field
             return res.status(400).json({ message: "Phone number cannot be empty." });
        }
        fieldsToUpdate.phone_number = phone_number;
        }
        // Handle profile photo upload
        if (req.file) { // 'profilePhoto' is the field name from multer
            // Delete old photo if it exists and is different
            if (user.profile_photo_url && user.profile_photo_url !== req.file.filename) {
                const oldPhotoPath = path.join(__dirname, '../uploads/profiles', user.profile_photo_url);
                try {
                    await fs.unlink(oldPhotoPath);
                    console.log(`Deleted old profile photo: ${oldPhotoPath}`);
                } catch (unlinkError) {
                    console.warn(`Could not delete old profile photo ${oldPhotoPath}:`, unlinkError.message);
                }
            }
            fieldsToUpdate.profile_photo_url = req.file.filename; // Save new photo filename
        }

        if (Object.keys(fieldsToUpdate).length === 0 && !req.file) {
            return res.status(400).json({ message: "No update information provided." });
        }
        
        await user.update(fieldsToUpdate);

        // Fetch the updated user to return all fields, including new photo URL
        const updatedUser = await User.findByPk(userId, {
             attributes: [
                'id', 'email', 'name', 'role', 'created_at',
                'profile_photo_url', 'bio', 'phone_number'
            ]
        });

        res.status(200).json({
            message: "Profile updated successfully.",
            user: updatedUser
        });

    } catch (error) {
        console.error("Error updating user profile:", error);
        // If it's a file system error during multer or unlink, it might not be a 500 from DB
        if (error.code && error.code.startsWith('LIMIT_')) { // Multer error
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error while updating profile." });
    }
};

exports.getPublicUserProfile = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findByPk(userId, {
            attributes: [ // Only select fields safe for public display
                'id',
                'name',
                'profile_photo_url',
                'bio',
                'created_at', // e.g., "Joined on..."
                'role' // To know if they are an owner, to fetch listings
            ]
        });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        let userListings = [];
        if (user.role === 'owner') {
            userListings = await Listing.findAll({
                where: { owner_id: userId, status: 'active' }, // Only active listings
                attributes: ['id', 'title', 'price', 'type', 'location', 'photos'], // Basic listing info
                limit: 5, // Limit the number of listings shown on profile
                order: [['created_at', 'DESC']]
            });
        }
        
        // Optionally, fetch reviews written by this user
        // const userReviews = await Review.findAll({
        //     where: { user_id: userId },
        //     include: [{ model: Listing, attributes: ['id', 'title'] }],
        //     limit: 5,
        //     order: [['created_at', 'DESC']]
        // });

        res.status(200).json({
            user: user,
            listings: userListings,
            // reviews: userReviews // Uncomment if you implement this
        });

    } catch (error) {
        console.error("Error fetching public user profile:", error);
        res.status(500).json({ message: "Server error while fetching public profile." });
    }
};

exports.changePassword = async (req, res) => {
    const userId = req.user.id;
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    try {
        if (!oldPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({ message: "All password fields are required." });
        }
        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ message: "New passwords do not match." });
        }
        if (newPassword.length < 6) { // Or your defined password policy
            return res.status(400).json({ message: "New password must be at least 6 characters long." });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." }); // Should not happen if authenticated
        }

        // Verify old password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect old password." });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update user's password
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: "Password changed successfully." });

    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ message: "Server error while changing password." });
    }
};