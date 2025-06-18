
// backend/controllers/listingController.js

const { Op } = require('sequelize');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Review = require('../models/Review');
const path = require('path'); // Still needed for __dirname in config setup if needed, but less for file ops
const fs = require('fs').promises; // Still useful for other potential file ops, but not photo cleanup here
const Booking = require('../models/Booking');
const Analytics = require('../models/Analytics');
const logger = require('../config/logger');
// const sharp = require('sharp'); // <--- REMOVED: No longer needed for local processing
const cloudinary = require('cloudinary').v2; // <--- ADDED: For Cloudinary operations
const cloudinaryConfig = require('../config/cloudinaryConfig'); // <--- ASSUMPTION: Your Cloudinary config is here

// Configure Cloudinary - Ensure this is done before using it
// In a real app, this config setup might live in config/cloudinaryConfig.js
// For demonstration, let's assume the import runs the config or you call a setup function
if (!cloudinary.config().cloud_name) {
    cloudinaryConfig.setup(); // Example: if cloudinaryConfig exports a setup function
}


// Helper function for image deletion from Cloudinary
const deleteFromCloudinary = async (publicId) => {
    if (!publicId) {
        logger.warn('[deleteFromCloudinary] Attempted to delete null or empty publicId.');
        return; // Do nothing if publicId is null/empty
    }
    try {
        // By default, destroy removes all derived versions (like thumbnails created by Cloudinary)
        const result = await cloudinary.uploader.destroy(publicId);
        if (result.result === 'ok') {
            logger.info(`[deleteFromCloudinary] Successfully deleted Cloudinary asset: ${publicId}`);
        } else {
             // Log if Cloudinary reports an issue other than 'not found'
            if (result.result !== 'not found') {
                 logger.warn(`[deleteFromCloudinary] Cloudinary reported issue deleting ${publicId}: ${result.result}`);
            } else {
                 logger.debug(`[deleteFromCloudinary] Cloudinary asset not found, skipping deletion: ${publicId}`);
            }
        }
    } catch (error) {
        logger.error(`[deleteFromCloudinary] Error deleting Cloudinary asset ${publicId}:`, { error: error.message, stack: error.stack });
        // Decide if this error should be thrown or just logged.
        // For cleanup during update/delete, often just logging is sufficient.
    }
};


// REMOVED: processImage helper function - No longer needed with Cloudinary

exports.getListings = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'DESC',
      type, priceMin, priceMax, roomsMin, location, search,
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    let whereClause = { status: 'active' };

    // These checks are for constructing the query, not for validation
    if (type) whereClause.type = type;
    if (priceMin && priceMax) whereClause.price = { [Op.between]: [parseFloat(priceMin), parseFloat(priceMax)] };
    else if (priceMin) whereClause.price = { [Op.gte]: parseFloat(priceMin) };
    else if (priceMax) whereClause.price = { [Op.lte]: parseFloat(priceMax) };
    if (roomsMin) whereClause.rooms = { [Op.gte]: parseInt(roomsMin, 10) };

    if (location) whereClause.location = { [Op.like]: `%${location}%` };
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const validSortFields = ['created_at', 'price', 'rooms', 'area'];
    const order = [];
    if (validSortFields.includes(sortBy)) {
      order.push([sortBy, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']);
    } else {
      order.push(['created_at', 'DESC']);
    }

    const { count, rows: listings } = await Listing.findAndCountAll({
      where: whereClause,
      include: [{ model: User, as: 'Owner', attributes: ['id', 'name', 'email', 'profile_photo_url'] }],
      order: order,
      limit: parsedLimit,
      offset: offset,
    });

    // Listings returned here will have the 'photos' array containing Cloudinary public_ids.
    // The frontend will need to construct the URLs.

    res.status(200).json({
      totalItems: count,
      totalPages: Math.ceil(count / parsedLimit),
      currentPage: parseInt(page, 10),
      listings,
    });

  } catch (error) {
    logger.error('Error fetching listings:', { error: error.message, stack: error.stack, query: req.query });
    next(error); // Pass to centralized error handler
  }
};

// MODIFIED: createListing (No local file processing)
exports.createListing = async (req, res, next) => {
  const owner_id = req.user.id;
  const { title, description, price, rooms, area, location, amenities, type, latitude, longitude } = req.body;
  const files = req.files || []; // These are now processed by multer-storage-cloudinary

  // Get Cloudinary public_ids from the uploaded files
  // multer-storage-cloudinary adds public_id to the file object
  const photoPublicIds = files.map(file => file.public_id);

  // No local image processing or thumbnail creation needed here.
  // Cloudinary handles storage and transformation.

  try {
    const newListing = await Listing.create({
      owner_id: owner_id,
      title: title,
      description: description,
      price: parseFloat(price),
      rooms: rooms ? parseInt(rooms, 10) : null,
      area: area ? parseFloat(area) : null,
      location: location,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      amenities: amenities || null,
      type: type,
      status: 'pending', // Listings start as pending for admin approval
      photos: photoPublicIds.length > 0 ? photoPublicIds : null // Store public_ids
    });

    // Emit socket event if status is 'pending'
    if (newListing.status === 'pending') {
        const io = req.app.get('socketio');
        if (io) {
            io.to('admin_room').emit('admin_new_pending_listing', {
            message: `New listing '${newListing.title}' needs approval.`,
            listingId: newListing.id,
            });
            logger.info(`Emitted 'admin_new_pending_listing' to admin_room for listing ${newListing.id}`);
        }
    }

    res.status(201).json({
      message: 'Listing created successfully! Awaiting admin approval.',
      listing: {
        id: newListing.id,
        title: newListing.title,
        owner_id: newListing.owner_id,
        status: newListing.status,
        // The photos array now contains public_ids
        photos: newListing.photos,
        latitude: newListing.latitude,
        longitude: newListing.longitude
      }
    });

  } catch (error) {
    // IMPORTANT: If DB creation fails after uploading to Cloudinary,
    // the files will remain on Cloudinary. A robust solution would
    // implement cleanup here or use Cloudinary's explicit upload API
    // which allows rollback on failure. For this example, we just log.
    logger.error('Error creating listing:', { userId: owner_id, body: req.body, error: error.message, stack: error.stack });
     // Attempt to delete uploaded files from Cloudinary if DB save fails
     if (photoPublicIds.length > 0) {
        logger.warn('[createListing] Attempting to clean up Cloudinary files due to DB error...');
        for (const publicId of photoPublicIds) {
            await deleteFromCloudinary(publicId); // Use the helper
        }
     }
    next(error); // Pass to centralized error handler
  }
};

exports.getListingById = async (req, res, next) => {
  const listingId = req.params.id;
  logger.info(`[getListingById] Start: Request for listing ID ${listingId}`);

  let userId = null;
  let userRole = null;

  if (req.user && typeof req.user === 'object') {
    userId = req.user.id;
    userRole = req.user.role;
    logger.debug(`[getListingById] Authenticated user: ID=${userId}, Role=${userRole}`);
  } else {
    logger.debug("[getListingById] No authenticated user (public access attempt).");
  }

  try {
    logger.debug(`[getListingById] Fetching listing (unscoped): ID ${listingId}`);
    const listing = await Listing.unscoped().findOne({
      where: { id: listingId },
      include: [
        {
          model: User,
          as: 'Owner',
          attributes: ['id', 'name', 'email', 'profile_photo_url']
        }
      ]
    });

    if (!listing) {
      logger.warn(`[getListingById] Listing ID ${listingId} not found in database.`);
      return res.status(404).json({ message: `Listing not found.` });
    }
    logger.debug(`[getListingById] Found listing: ID ${listing.id}, Status ${listing.status}, OwnerID ${listing.owner_id}`);

    const isOwner = userId && listing.owner_id === userId;
    const isAdmin = userRole === 'admin';
    const isActiveAndPublic = listing.status === 'active';

    const canView = isActiveAndPublic || isAdmin || isOwner;

    if (!canView) {
      logger.warn(`[getListingById] Access denied for listing ${listingId}. UserID: ${userId}, UserRole: ${userRole}, ListingStatus: ${listing.status}, IsOwner: ${isOwner}, IsAdmin: ${isAdmin}`);
      return res.status(404).json({ message: 'Listing not found or you do not have permission to view it.' });
    }

    logger.info(`[getListingById] Access granted for listing ${listingId}. UserID: ${userId}, UserRole: ${userRole}, IsOwner: ${isOwner}, IsAdmin: ${isAdmin}, ListingStatus: ${listing.status}`);

    // Increment views count only for active listings.
    if (isActiveAndPublic) {
        try {
            const [analyticsEntry, created] = await Analytics.findOrCreate({
                where: { listing_id: listingId },
                defaults: { listing_id: listingId, views_count: 1 }
            });
            if (!created) {
                await analyticsEntry.increment('views_count');
            }
            logger.debug(`[getListingById] Views count updated for active listing ${listingId}`);
        } catch (analyticsError) {
            logger.error('[getListingById] Error updating views count:', { listingId, error: analyticsError.message, stack: analyticsError.stack });
        }
    }

    // The listing object returned here will have the 'photos' array containing Cloudinary public_ids.
    // The frontend is expected to construct the image URLs.
    res.status(200).json(listing);

  } catch (error) {
    logger.error('[getListingById] Controller error:', { listingId, error: error.message, stack: error.stack });
    if (error.name === 'SequelizeDatabaseError' && error.original && error.original.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
        logger.warn(`[getListingById] Invalid listing ID format for ID: ${listingId}`);
        return res.status(400).json({ message: 'Invalid listing ID format.' });
    }
    next(error);
  }
};

exports.getReviewsByListingId = async (req, res, next) => {
  const listingId = req.params.listingId;
  try {
    const reviews = await Review.findAll({
      where: { listing_id: listingId },
      order: [['created_at', 'DESC']],
      include: [{
        model: User,
        as: 'User',
        attributes: ['id', 'name', 'email', 'profile_photo_url']
      }]
    });
    res.status(200).json(reviews);
  } catch (error) {
    logger.error('Error fetching reviews:', { listingId, error: error.message, stack: error.stack });
    next(error);
  }
};

exports.createReview = async (req, res, next) => {
  const listingId = req.params.listingId;
  const userId = req.user.id;
  const { rating, comment } = req.body;
  try {
    const newReview = await Review.create({
      listing_id: listingId,
      user_id: userId,
      rating: parseInt(rating, 10),
      comment: comment || null
    });
    const reviewWithUser = await Review.findByPk(newReview.id, {
        include: [{
            model: User,
            as: 'User',
            attributes: ['id', 'name', 'email', 'profile_photo_url']
        }]
    });
    res.status(201).json({
      message: 'Review added successfully!',
      review: reviewWithUser
    });
  } catch (error) {
    logger.error('Error creating review:', { listingId, userId, body: req.body, error: error.message, stack: error.stack });
    next(error);
  }
};

exports.getOwnerListings = async (req, res, next) => {
  const ownerId = req.user.id;
  try {
    // USE UNSCOPED TO FETCH ALL LISTINGS REGARDLESS OF STATUS FOR THE OWNER
    const listings = await Listing.unscoped().findAll({
      where: {
        owner_id: ownerId
      },
      order: [['created_at', 'DESC']],
      include: [{ model: Analytics, attributes: ['views_count'] }]
    });
    // Listings returned here will have the 'photos' array containing Cloudinary public_ids.
    res.status(200).json(listings);
  } catch (error) {
    logger.error('Error fetching owner listings:', { ownerId, error: error.message, stack: error.stack });
    next(error);
  }
};

// MODIFIED: deleteListing (Delete from Cloudinary)
exports.deleteListing = async (req, res, next) => {
  const listingId = req.params.id;
  const userId = req.user.id;
  try {
    const listing = await Listing.unscoped().findOne({ // Use unscoped to allow owner to delete listings regardless of current status
      where: {
        id: listingId,
        owner_id: userId
      }
    });
    if (!listing) {
      logger.warn(`Listing ${listingId} not found or user ${userId} does not have permission to delete.`);
      return res.status(404).json({ message: 'Listing not found or you do not have permission to delete it.' });
    }

    // Delete images from Cloudinary using public_ids
    if (listing.photos && listing.photos.length > 0) {
        for (const publicId of listing.photos) {
            await deleteFromCloudinary(publicId); // Use the helper
        }
    }

    await listing.destroy();
    res.status(200).json({ message: 'Listing deleted successfully.' });
  } catch (error) {
    logger.error('Error deleting listing:', { listingId, userId, error: error.message, stack: error.stack });
    next(error);
  }
};

exports.getListingForEdit = async (req, res, next) => {
  const listingId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  try {
    const listing = await Listing.unscoped().findByPk(listingId, {
      include: [{
        model: User,
        as: 'Owner',
        attributes: ['id', 'name', 'email', 'profile_photo_url']
      }]
    });
    if (!listing) {
      logger.warn(`Listing ${listingId} not found for edit.`);
      return res.status(404).json({ message: 'Listing not found.' });
    }
    if (listing.owner_id !== userId && userRole !== 'admin') {
      logger.warn(`User ${userId} (role: ${userRole}) attempted to edit listing ${listingId} they don't own.`);
      return res.status(403).json({ message: 'You do not have permission to edit this listing.' });
    }
    // Listing returned here will have the 'photos' array containing Cloudinary public_ids.
    res.status(200).json(listing);
  } catch (error) {
    logger.error('Error fetching listing for edit:', { listingId, userId, error: error.message, stack: error.stack });
    next(error);
  }
};

// MODIFIED: updateListing (Handle photo manifest with public_ids, delete from Cloudinary)
exports.updateListing = async (req, res, next) => {
  const listingId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  // photoManifestRaw will contain public_ids of existing photos + '__NEW_PHOTO__' markers
  const { photoManifest: photoManifestRaw, status, ...restOfBody } = req.body;
  const newlyUploadedFiles = req.files || []; // These are now processed by multer-storage-cloudinary

  // Get Cloudinary public_ids for newly uploaded files
  const newlyUploadedPublicIds = newlyUploadedFiles.map(file => file.public_id);

  try {
    const listingToUpdate = await Listing.unscoped().findByPk(listingId);
    if (!listingToUpdate) {
      // If listing not found, clean up any newly uploaded files
      if (newlyUploadedPublicIds.length > 0) {
          logger.warn('[updateListing] Listing not found, attempting to clean up newly uploaded Cloudinary files...');
          for (const publicId of newlyUploadedPublicIds) {
              await deleteFromCloudinary(publicId);
          }
      }
      logger.warn(`Listing ${listingId} not found for update.`);
      return res.status(404).json({ message: 'Listing not found.' });
    }
    if (listingToUpdate.owner_id !== userId && userRole !== 'admin') {
       // If unauthorized, clean up any newly uploaded files
        if (newlyUploadedPublicIds.length > 0) {
            logger.warn('[updateListing] Unauthorized update attempt, attempting to clean up newly uploaded Cloudinary files...');
            for (const publicId of newlyUploadedPublicIds) {
                await deleteFromCloudinary(publicId);
            }
        }
      logger.warn(`User ${userId} (role: ${userRole}) attempted to update listing ${listingId} they don't own.`);
      return res.status(403).json({ message: 'You do not have permission to update this listing.' });
    }

    const updateData = {
      title: restOfBody.title,
      description: restOfBody.description,
      price: restOfBody.price === '' ? null : parseFloat(restOfBody.price),
      rooms: restOfBody.rooms === '' ? null : parseInt(restOfBody.rooms, 10),
      area: restOfBody.area === '' ? null : parseFloat(restOfBody.area),
      location: restOfBody.location,
      amenities: restOfBody.amenities || null, // Ensure null if empty string/undefined
      type: restOfBody.type,
      latitude: restOfBody.latitude === '' ? null : parseFloat(restOfBody.latitude),
      longitude: restOfBody.longitude === '' ? null : parseFloat(restOfBody.longitude),
    };

    let finalPhotoArrayForDb = [];
    // Get existing public_ids from the database record
    const oldPhotoPublicIdsInDb = listingToUpdate.photos || [];
    const publicIdsToDelete = []; // Array to hold public_ids that are being removed

    if (photoManifestRaw) {
        const parsedPhotoManifest = JSON.parse(photoManifestRaw);
        let newFileIdx = 0;

        for (const manifestItem of parsedPhotoManifest) {
            if (manifestItem === '__NEW_PHOTO__') {
                if (newFileIdx < newlyUploadedPublicIds.length) {
                    // Add the public_id of the new file
                    finalPhotoArrayForDb.push(newlyUploadedPublicIds[newFileIdx]);
                    newFileIdx++;
                } else {
                    logger.warn(`[UpdateListing] Manifest inconsistency: Expected '__NEW_PHOTO__', but no more uploaded files available. Listing ID: ${listingId}`);
                     // This case indicates a client-side issue in generating the manifest
                }
            } else {
                // Add the public_id of the existing photo that is kept
                finalPhotoArrayForDb.push(manifestItem);
            }
        }

        // Any newly uploaded files that were NOT included in the manifest
        // (this shouldn't happen with correct client-side logic, but handle defensively)
         while (newFileIdx < newlyUploadedPublicIds.length) {
             logger.warn(`[UpdateListing] Newly uploaded file ${newlyUploadedPublicIds[newFileIdx]} was not referenced in photoManifest for listing ${listingId}. It will be added to the list.`);
             finalPhotoArrayForDb.push(newlyUploadedPublicIds[newFileIdx]);
             newFileIdx++;
         }


        // Determine which old public_ids from the database are NOT in the final list -> these need deletion
        publicIdsToDelete.push(...oldPhotoPublicIdsInDb.filter(
            oldPublicId => !finalPhotoArrayForDb.includes(oldPublicId)
        ));

        // Set the updated photos array for the database
        updateData.photos = finalPhotoArrayForDb.length > 0 ? finalPhotoArrayForDb : null;

    } else if (newlyUploadedPublicIds.length > 0) {
        // Case: New files uploaded, but no manifest.
        // This means the client isn't managing existing photos correctly.
        // Option 1: Overwrite existing photos with new ones (risky, data loss)
        // Option 2: Append new photos to existing ones (less risky) - Let's do this.
        logger.warn(`[UpdateListing] No photoManifest received, but new files were uploaded for listing ${listingId}. Appending new files to existing ones.`);
        updateData.photos = [...oldPhotoPublicIdsInDb, ...newlyUploadedPublicIds];
         // No old photos are marked for deletion in this scenario unless they were already null
    } else {
        // Case: No new files uploaded, and no manifest.
        // This implies only text fields are updated, or the client sent an empty manifest.
        // We should retain the existing photos unless the manifest explicitly removed them (handled above).
        if (photoManifestRaw && JSON.parse(photoManifestRaw).length === 0) {
             // Client sent an empty manifest, indicating all photos should be removed
             publicIdsToDelete.push(...oldPhotoPublicIdsInDb);
             updateData.photos = null;
        } else {
            // No new files, no manifest (or manifest was empty/invalid) - keep existing photos
            updateData.photos = oldPhotoPublicIdsInDb.length > 0 ? oldPhotoPublicIdsInDb : null;
        }
    }

    // Perform deletion of photos no longer associated with the listing
    if (publicIdsToDelete.length > 0) {
        logger.info(`[UpdateListing] Deleting ${publicIdsToDelete.length} old photos from Cloudinary for listing ${listingId}.`);
        for (const publicId of publicIdsToDelete) {
            await deleteFromCloudinary(publicId); // Use the helper
        }
    }

    let finalStatus = listingToUpdate.status;

    // Admin can set the status directly
    if (userRole === 'admin' && status) {
        // Validate status here if not done by Sequelize model
        if (['active', 'pending', 'archived', 'rejected'].includes(status)) {
            updateData.status = status;
            finalStatus = status;
        } else {
             // If admin provided invalid status, clean up new uploads and return error
            if (newlyUploadedPublicIds.length > 0) {
                 logger.warn('[updateListing] Admin provided invalid status, cleaning up newly uploaded Cloudinary files...');
                 for (const publicId of newlyUploadedPublicIds) {
                    await deleteFromCloudinary(publicId);
                 }
            }
            return res.status(400).json({ message: 'Invalid status provided by admin.' });
        }
    } else if (userRole !== 'admin' && listingToUpdate.status !== 'pending') {
        // If owner edits, set status to 'pending' for re-approval, unless it's already pending.
        updateData.status = 'pending';
        finalStatus = 'pending';
    }
    // If admin edits and doesn't provide status, or owner edits while already pending, status remains unchanged.


    const updatedListing = await listingToUpdate.update(updateData);

    // Emit socket event if status changed to 'pending' (from owner edit or admin setting it)
    if (finalStatus === 'pending' && listingToUpdate.status !== 'pending') {
        const io = req.app.get('socketio');
        if (io) {
            io.to('admin_room').emit('admin_pending_count_changed', { // Re-using existing event for admin dashboard
                message: `Listing '${updatedListing.title}' was updated and now requires approval.`,
                listingId: updatedListing.id,
            });
            logger.info(`Emitted 'admin_pending_count_changed' to admin_room for listing ${updatedListing.id} after edit.`);
        }
    }

    res.status(200).json({
      message: 'Listing updated successfully!',
      listing: {
        id: updatedListing.id,
        title: updatedListing.title,
        owner_id: updatedListing.owner_id,
        status: updatedListing.status,
         // The photos array now contains public_ids
        photos: updatedListing.photos,
        latitude: updatedListing.latitude,
        longitude: updatedListing.longitude
      }
    });

  } catch (error) {
    // IMPORTANT: If DB update fails after processing uploads/deletions,
    // it's complex to fully rollback Cloudinary changes. Logging is crucial.
     // Attempt to delete newly uploaded files from Cloudinary if DB save fails
     if (newlyUploadedPublicIds.length > 0) {
        logger.warn('[updateListing] Attempting to clean up newly uploaded Cloudinary files due to DB error...');
        for (const publicId of newlyUploadedPublicIds) {
            await deleteFromCloudinary(publicId);
        }
     }
    logger.error('Error updating listing:', { listingId, userId, body: req.body, error: error.message, stack: error.stack });
    next(error);
  }
};

// NEW: Controller function to toggle archive status
exports.toggleListingArchiveStatus = async (req, res, next) => {
  const listingId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  const { status: requestedStatus } = req.body; // The requested new status from frontend ('archived' or 'pending' when unarchiving)

  try {
    const listing = await Listing.unscoped().findByPk(listingId);

    if (!listing) {
      logger.warn(`Listing ${listingId} not found for archive status update.`);
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const isOwner = listing.owner_id === userId;
    const isAdmin = userRole === 'admin';

    // Authorization check
    if (!isOwner && !isAdmin) {
      logger.warn(`User ${userId} (role: ${userRole}) attempted to change archive status of listing ${listingId} they don't own.`);
      return res.status(403).json({ message: 'You do not have permission to change the archive status of this listing.' });
    }

    let finalStatus = listing.status; // Default to current status
    let statusChanged = false;

    if (isAdmin) {
      // Admin can set any valid status
      if (['active', 'pending', 'archived', 'rejected'].includes(requestedStatus) && requestedStatus !== listing.status) {
          finalStatus = requestedStatus;
          statusChanged = true;
      } else if (!['active', 'pending', 'archived', 'rejected'].includes(requestedStatus)) {
           return res.status(400).json({ message: 'Invalid status provided by admin.' });
      }
       // If admin sends the current status, we just return success without updating
    } else if (isOwner) {
      // Owner specific logic for archive/unarchive
      if (requestedStatus === 'archived') {
        // Owner can archive if listing is active, pending, or rejected, and not already archived
        if (['active', 'pending', 'rejected'].includes(listing.status)) {
           if (listing.status !== 'archived') {
                finalStatus = 'archived';
                statusChanged = true;
           } else {
               // Already archived, return success
               return res.status(200).json({ message: 'Listing is already archived.', listing });
           }
        } else {
          logger.warn(`Owner ${userId} attempted to archive listing ${listingId} in un-archivable state: ${listing.status}.`);
          return res.status(400).json({ message: 'Listing is in a state that cannot be archived by you.' });
        }
      } else if (requestedStatus === 'pending') {
        // Owner can unarchive ONLY if listing is currently archived. Unarchiving sends to 'pending' for re-approval.
        if (listing.status === 'archived') {
          finalStatus = 'pending';
          statusChanged = true;
        } else {
          logger.warn(`Owner ${userId} attempted to unarchive a non-archived listing ${listingId}. Status: ${listing.status}`);
          return res.status(400).json({ message: 'Listing is not archived and cannot be unarchived by you.' });
        }
      } else {
        logger.warn(`Owner ${userId} attempted an invalid archive/unarchive request for listing ${listingId}: requested status ${requestedStatus}`);
        return res.status(400).json({ message: 'Invalid status request for owner. Owners can only archive or unarchive to pending.' });
      }
    }

    // If the status is not changing or invalid request for owner, return early (already handled by specific checks)
    if (!statusChanged) {
         return res.status(200).json({ message: 'Listing status is already the requested status or request was invalid.', listing });
    }


    await listing.update({ status: finalStatus });

    // Emit socket event if status changed to 'pending' (from unarchiving or owner edit setting to pending)
    // Also notify admin if status changes to 'rejected' or 'active' directly (admin action)
    const io = req.app.get('socketio');
    if (io) {
        if (finalStatus === 'pending') {
             io.to('admin_room').emit('admin_pending_count_changed', { // Use count changed event
                 message: `Listing '${listing.title}' (ID: ${listing.id}) was unarchived and needs approval.`,
                 listingId: listing.id,
             });
             logger.info(`Emitted 'admin_pending_count_changed' to admin_room for listing ${listing.id} (status changed to pending).`);
        } else if (isAdmin && ['active', 'rejected', 'archived'].includes(finalStatus)) {
             // Notify admin dashboard potentially for listing list refresh
             io.to('admin_room').emit('admin_listing_status_updated', {
                 message: `Listing '${listing.title}' (ID: ${listing.id}) status changed to '${finalStatus}'.`,
                 listingId: listing.id,
                 newStatus: finalStatus,
             });
              logger.info(`Emitted 'admin_listing_status_updated' to admin_room for listing ${listing.id} (status changed by admin to ${finalStatus}).`);
        }
    }


    res.status(200).json({ message: `Listing successfully ${requestedStatus === 'archived' ? 'archived' : `unarchived to ${finalStatus}`}.`, listing });

  } catch (error) {
    logger.error('Error toggling listing archive status:', { listingId, userId, body: req.body, error: error.message, stack: error.stack });
    next(error);
  }
};


exports.getListingBookedDates = async (req, res, next) => {
    const { listingId } = req.params;
    try {
        const confirmedBookings = await Booking.findAll({
            where: {
                listing_id: listingId,
                status: 'confirmed'
            },
            attributes: ['start_date', 'end_date']
        });
        const bookedDateRanges = confirmedBookings.map(b => ({
            start: b.start_date,
            end: b.end_date
        }));
        res.status(200).json(bookedDateRanges);
    } catch (error) {
        logger.error("Error fetching booked dates:", { listingId, error: error.message, stack: error.stack });
        next(error);
    }
};

exports.getMapData = async (req, res, next) => {
  try {
    const { type, priceMin, priceMax, roomsMin, location, search } = req.query;

    let whereClause = {
      status: 'active',
      latitude: { [Op.ne]: null },
      longitude: { [Op.ne]: null }
    };

    if (type) whereClause.type = type;
    if (priceMin && priceMax) whereClause.price = { [Op.between]: [parseFloat(priceMin), parseFloat(priceMax)] };
    else if (priceMin) whereClause.price = { [Op.gte]: parseFloat(priceMin) };
    else if (priceMax) whereClause.price = { [Op.lte]: parseFloat(priceMax) };
    if (roomsMin) whereClause.rooms = { [Op.gte]: parseInt(roomsMin, 10) };

    if (location) whereClause.location = { [Op.like]: `%${location}%` };
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const listings = await Listing.findAll({
      where: whereClause,
      attributes: [
        'id',
        'title',
        'latitude',
        'longitude',
        'price',
        'type',
        'photos', // This will now contain public_ids
        'location',
        'rooms'
      ]
    });
    // Listings returned here will have the 'photos' array containing Cloudinary public_ids.
    res.status(200).json(listings);

  } catch (error) {
    logger.error('Error fetching map data listings:', { query: req.query, error: error.message, stack: error.stack });
    next(error);
  }
};
