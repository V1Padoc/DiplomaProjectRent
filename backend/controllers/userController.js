// backend/controllers/userController.js

const User = require('../models/User');
const Listing = require('../models/Listing');
const Booking = require('../models/Booking');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { cloudinary } = require('../config/cloudinaryConfig'); // Ensure cloudinary object is exported from your config
const logger = require('../config/logger'); // Assuming you have a logger setup

/**
 * Helper function to extract the public_id from a Cloudinary URL.
 * Cloudinary URLs typically look like:
 * `http://res.cloudinary.com/<cloud_name>/image/upload/[v<version>/]<public_id>.<format>`
 * We need to extract `<public_id>.<format>` and then remove the format.
 * If folders are used, the public_id includes the folder structure, e.g., 'folder/image_name'.
 *
 * @param {string} url - The Cloudinary image URL.
 * @returns {string|null} The Cloudinary public_id or null if not found/invalid.
 */
const getPublicIdFromUrl = (url) => {
    if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
        return null;
    }
    try {
        // Split the URL by '/'
        const parts = url.split('/');
        // Find the 'upload' segment index
        const uploadIndex = parts.indexOf('upload');

        if (uploadIndex === -1 || uploadIndex + 1 >= parts.length) {
            logger.warn(`[getPublicIdFromUrl] 'upload' segment not found or URL is too short: ${url}`);
            return null;
        }

        // The public ID part starts after 'upload/' and usually after the version number (e.g., 'v12345').
        // So, we take all parts after 'upload' + 1 (for version or transformation segment).
        // Let's be more robust: find the last part before the file extension.
        const fileNameWithExtension = parts.pop(); // Get 'image_name.jpg'
        if (!fileNameWithExtension) return null;

        const fileName = fileNameWithExtension.split('.')[0]; // Get 'image_name'

        // The public ID is the remaining path after the 'upload' segment and any transformations/version
        // up to the file name.
        let publicIdParts = [];
        let afterUpload = false;
        for (const part of parts) {
            if (afterUpload) {
                // Skip version number (e.g., 'v1678901234') and standard transformations
                if (!part.startsWith('v') && part.length > 0 && !part.includes('_')) { // Basic heuristic for transformations
                    publicIdParts.push(part);
                }
            }
            if (part === 'upload') {
                afterUpload = true;
            }
        }
        
        // Add the extracted file name
        if (fileName) {
            publicIdParts.push(fileName);
        }

        const publicId = publicIdParts.join('/');

        if (publicId.length === 0) {
            logger.warn(`[getPublicIdFromUrl] Could not determine public_id for URL: ${url}`);
            return null;
        }

        logger.debug(`[getPublicIdFromUrl] Extracted publicId: ${publicId} from URL: ${url}`);
        return publicId;

    } catch (e) {
        logger.error(`[getPublicIdFromUrl] Error parsing public_id from URL: ${url}`, { error: e.message, stack: e.stack });
        return null;
    }
};

// PUT /api/users/profile - Update user profile
exports.updateUserProfile = async (req, res) => {
    const userId = req.user.id; // Get ID from authentication middleware
    const { name, last_name, bio, phone_number } = req.body;

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            logger.warn(`[updateUserProfile] User not found for ID: ${userId}`);
            return res.status(404).json({ message: "User not found." });
        }

        const fieldsToUpdate = {};
        if (name !== undefined) fieldsToUpdate.name = name;
        if (last_name !== undefined) fieldsToUpdate.last_name = last_name;
        if (bio !== undefined) fieldsToUpdate.bio = bio;
        
        // Validate and set phone_number
        if (phone_number !== undefined) {
            if (phone_number.trim() === '') {
                 return res.status(400).json({ message: "Phone number cannot be empty." });
            }
            fieldsToUpdate.phone_number = phone_number;
        }

        // Handle uploaded profile photo
        if (req.file) {
            // New photo uploaded, delete the old one from Cloudinary if it exists
            if (user.profile_photo_url) {
                const oldPublicId = getPublicIdFromUrl(user.profile_photo_url);
                if (oldPublicId) {
                    try {
                        const result = await cloudinary.uploader.destroy(oldPublicId);
                        if (result.result === 'ok') {
                            logger.info(`[updateUserProfile] Successfully deleted old profile photo from Cloudinary: ${oldPublicId}`);
                        } else if (result.result !== 'not found') {
                            logger.warn(`[updateUserProfile] Cloudinary reported issue deleting old profile photo ${oldPublicId}: ${result.result}`);
                        } else {
                            logger.debug(`[updateUserProfile] Old profile photo ${oldPublicId} not found on Cloudinary (already deleted or incorrect ID).`);
                        }
                    } catch (deleteError) {
                        logger.error(`[updateUserProfile] Error deleting old profile photo ${oldPublicId} from Cloudinary:`, { error: deleteError.message, stack: deleteError.stack });
                        // Decide if this error should block the update. For profile photos, logging might be enough.
                    }
                } else {
                    logger.warn(`[updateUserProfile] Could not extract public_id from old profile_photo_url: ${user.profile_photo_url}. Skipping old photo deletion.`);
                }
            }
            // Save the new photo URL from Cloudinary (provided by multer-storage-cloudinary)
            fieldsToUpdate.profile_photo_url = req.file.path;
            logger.info(`[updateUserProfile] New profile photo uploaded: ${req.file.path} for user ${userId}`);
        }

        if (Object.keys(fieldsToUpdate).length === 0) {
            logger.debug(`[updateUserProfile] No update information provided for user ${userId}.`);
            return res.status(400).json({ message: "No update information provided." });
        }
        
        // Update user data in the database
        await user.update(fieldsToUpdate);

        // Return updated user data (excluding password)
        const updatedUser = await User.findByPk(userId, {
             attributes: { exclude: ['password'] }
        });

        res.status(200).json({
            message: "Profile updated successfully.",
            user: updatedUser
        });

    } catch (error) {
        logger.error("Error updating user profile:", { userId, body: req.body, file: req.file, error: error.message, stack: error.stack });
        // Handle Multer errors if any
        if (error.code && error.code.startsWith('LIMIT_')) {
            // E.g., 'LIMIT_FILE_SIZE' or 'LIMIT_UNEXPECTED_FILE'
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error while updating profile." });
    }
};

// GET /api/users/public-profile/:userId - Get public user profile
exports.getPublicUserProfile = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findByPk(userId, {
            attributes: [
                'id',
                'name',
                'profile_photo_url',
                'bio',
                'created_at',
                'role'
            ]
        });

        if (!user) {
            logger.warn(`[getPublicUserProfile] User not found for public profile ID: ${userId}`);
            return res.status(404).json({ message: "User not found." });
        }

        let userListings = [];
        // If the user is an owner, find their active listings
        if (user.role === 'owner') {
            userListings = await Listing.findAll({
                where: { owner_id: userId, status: 'active' },
                attributes: ['id', 'title', 'price', 'type', 'location', 'photos'],
                limit: 5,
                order: [['created_at', 'DESC']]
            });
            logger.debug(`[getPublicUserProfile] Found ${userListings.length} active listings for owner ${userId}.`);
        }
        
        res.status(200).json({
            user: user,
            listings: userListings,
        });

    } catch (error) {
        logger.error("Error fetching public user profile:", { userId, error: error.message, stack: error.stack });
        res.status(500).json({ message: "Server error while fetching public profile." });
    }
};

// POST /api/users/change-password - Change password
exports.changePassword = async (req, res) => {
    const userId = req.user.id;
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    try {
        // Validate input data
        if (!oldPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({ message: "All password fields are required." });
        }
        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ message: "New passwords do not match." });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ message: "New password must be at least 6 characters long." });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            // This error is unlikely as the user is authenticated
            logger.error(`[changePassword] Authenticated user ${userId} not found in DB.`);
            return res.status(404).json({ message: "User not found." });
        }

        // Verify old password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect old password." });
        }

        // Hash and update the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        user.password = hashedPassword;
        await user.save();

        logger.info(`[changePassword] User ${userId} successfully changed password.`);
        res.status(200).json({ message: "Password changed successfully." });

    } catch (error) {
        logger.error("Error changing password:", { userId, error: error.message, stack: error.stack });
        res.status(500).json({ message: "Server error while changing password." });
    }
};

// GET /api/users/me/unread-booking-updates-count - Number of unread booking updates
exports.getUnreadBookingUpdatesCountForTenant = async (req, res) => {
    const tenantId = req.user.id;
                                  
    try {
        const count = await Booking.count({
            where: {
                tenant_id: tenantId,
                is_update_seen_by_tenant: false,
                status: { [Op.in]: ['confirmed', 'rejected'] }
            }
        });
        logger.debug(`[getUnreadBookingUpdatesCountForTenant] Unread count for tenant ${tenantId}: ${count}`);
        res.status(200).json({ unreadCount: count });
    } catch (error) {
        logger.error('Error fetching unread booking updates count for tenant:', { tenantId, error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Server error.' });
    }
};

// PUT /api/users/me/acknowledge-booking-updates - Mark updates as read
exports.acknowledgeBookingUpdatesForTenant = async (req, res) => {
    const tenantId = req.user.id;
    try {
        const [updatedCount] = await Booking.update(
            { is_update_seen_by_tenant: true },
            {
                where: {
                    tenant_id: tenantId,
                    is_update_seen_by_tenant: false,
                    status: { [Op.in]: ['confirmed', 'rejected'] }
                }
            }
        );
        logger.info(`[acknowledgeBookingUpdatesForTenant] ${updatedCount} booking updates acknowledged for tenant ${tenantId}`);
        res.status(200).json({ message: 'Booking updates acknowledged.', count: updatedCount });
    } catch (error) {
        logger.error('Error acknowledging booking updates for tenant:', { tenantId, error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Server error.' });
    }
};