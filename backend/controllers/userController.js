// backend/controllers/userController.js
const User = require('../models/User');
const Listing = require('../models/Listing'); // To fetch user's listings
const Review = require('../models/Review');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs'); 
const { Op } = require('sequelize');
const Booking = require('../models/Booking');
const sharp = require('sharp'); // <--- ADDED: Import sharp for image processing

// Helper function for image processing for profile photos
async function processProfileImage(filePath, outputFilename) {
  const tempFilePath = filePath; // This is the file saved by Multer
  // Profile photos are saved in 'uploads/profiles'
  const profileUploadDir = path.join(__dirname, '../uploads/profiles');
  const processedFilePath = path.join(profileUploadDir, outputFilename);

  const MAX_WIDTH = 400; // Max width for profile photos
  const MAX_HEIGHT = 400; // Max height for profile photos
  const QUALITY = 80; // JPEG quality for profile photos

  try {
    await sharp(tempFilePath)
      .resize(MAX_WIDTH, MAX_HEIGHT, { 
        fit: sharp.fit.cover, // Crop to cover the dimensions while maintaining aspect ratio
        position: sharp.strategy.entropy, // Focus on interesting parts for cropping
        withoutEnlargement: true // Don't enlarge if image is smaller than dimensions
      })
      .jpeg({ quality: QUALITY, progressive: true }) // Convert to JPEG, set quality, enable progressive loading
      .toFile(processedFilePath);

    // Delete the original (temporary) file uploaded by Multer
    if (filePath !== processedFilePath) { 
        await fs.unlink(tempFilePath);
    }
    return path.basename(processedFilePath); // Return only the filename for database storage
  } catch (error) {
    console.error(`Error processing profile image ${path.basename(tempFilePath)}:`, error);
    // Attempt to delete the temporary file if processing failed and it still exists
    try {
        await fs.unlink(tempFilePath);
    } catch (e) { 
        if (e.code !== 'ENOENT') { // Ignore if file already doesn't exist
            console.warn(`Could not clean up temporary profile image ${path.basename(tempFilePath)}:`, e.message);
        }
    }
    throw new Error(`Failed to process profile image: ${path.basename(tempFilePath)}`);
  }
}


// PUT /api/users/profile - Update current user's profile
exports.updateUserProfile = async (req, res) => {
    const userId = req.user.id; // From authMiddleware
    const { name, last_name, bio, phone_number } = req.body; // Added last_name

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Prepare fields to update
        const fieldsToUpdate = {};
        if (name !== undefined) fieldsToUpdate.name = name; // First Name
        if (last_name !== undefined) fieldsToUpdate.last_name = last_name; // Last Name
        if (bio !== undefined) fieldsToUpdate.bio = bio;
        
        if (phone_number !== undefined) {
            // Validation if phone_number is being set/updated and is empty
            if (phone_number === '') { // If they try to clear a mandatory field
                 return res.status(400).json({ message: "Phone number cannot be empty." });
            }
            fieldsToUpdate.phone_number = phone_number;
        }

        // Handle profile photo upload with image processing
        if (req.file) { // 'profilePhoto' is the field name from multerProfileConfig
            try {
                // Generate a new unique filename for the processed profile photo
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const originalExt = path.extname(req.file.originalname);
                const extension = originalExt ? originalExt.toLowerCase() : '.jpg'; // Ensure valid extension for sharp
                const processedFilename = `profile-${userId}-${uniqueSuffix}${extension}`; // new filename

                // Process the image: resize, convert, save, and delete the temporary multer file
                const finalFilename = await processProfileImage(req.file.path, processedFilename);

                // Delete old photo if it exists and is different from the new one
                if (user.profile_photo_url && user.profile_photo_url !== finalFilename) {
                    const oldPhotoPath = path.join(__dirname, '../uploads/profiles', user.profile_photo_url);
                    try {
                        await fs.unlink(oldPhotoPath);
                        console.log(`Deleted old profile photo: ${oldPhotoPath}`);
                    } catch (unlinkError) {
                        // Log if deletion fails, but don't fail the whole request for this
                        console.warn(`Could not delete old profile photo ${oldPhotoPath}:`, unlinkError.message);
                    }
                }
                fieldsToUpdate.profile_photo_url = finalFilename; // Save new PROCESSED photo filename
            } catch (processingError) {
                console.error("Error processing profile photo:", processingError);
                // If profile photo processing fails, we don't update the photo URL.
                // The main profile update can still proceed for other fields.
                return res.status(500).json({ message: `Profile photo processing failed: ${processingError.message}` });
            }
        }

        if (Object.keys(fieldsToUpdate).length === 0 && !req.file) {
            return res.status(400).json({ message: "No update information provided." });
        }
        
        await user.update(fieldsToUpdate);

        // Fetch the updated user to return all fields, including new photo URL
        const updatedUser = await User.findByPk(userId, {
             attributes: [
                'id', 'email', 'name', 'last_name', 'role', 'created_at', // Ensure last_name is included
                'profile_photo_url', 'bio', 'phone_number'
            ]
        });

        res.status(200).json({
            message: "Profile updated successfully.",
            user: updatedUser
        });

    } catch (error) {
        console.error("Error updating user profile:", error);
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
                'name', // First Name
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
        res.status(200).json({ unreadCount: count });
    } catch (error) {
        console.error('Error fetching unread booking updates count for tenant:', error); 
        res.status(500).json({ message: 'Server error.' }); 
    }
};

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
        console.log(`${updatedCount} booking updates acknowledged for tenant ${tenantId}`);
        res.status(200).json({ message: 'Booking updates acknowledged.', count: updatedCount });
    } catch (error) {
        console.error('Error acknowledging booking updates for tenant:', error); 
        res.status(500).json({ message: 'Server error.' });
    }
};