// backend/controllers/userController.js
const User = require('../models/User');
const fs = require('fs').promises;
const path = require('path');

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