// backend/controllers/listingController.js

const { Op } = require('sequelize');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Analytics = require('../models/Analytics');
const logger = require('../config/logger');
const { cloudinary } = require('../config/cloudinaryConfig'); // Assumes cloudinary object is exported

// Helper function to extract public_id from a Cloudinary URL
const getPublicIdFromUrl = (url) => {
    if (!url) return null;
    try {
        const parts = url.split('/');
        // Find the index of the upload type (e.g., 'upload', 'private', 'authenticated')
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) {
            logger.warn(`[getPublicIdFromUrl] Could not find 'upload' segment in URL: ${url}`);
            return null;
        }

        // The public ID usually starts after the version (e.g., 'v12345')
        // and includes the folder path if specified during upload.
        // We need to find the part that represents the folder/public_id.
        // It's typically after the version number, which is after 'upload/'.
        let publicIdParts = parts.slice(uploadIndex + 2); // +2 to skip 'upload' and 'vXXXXX'

        // The last part contains the filename with extension, e.g., 'my_image.jpg'
        const filenameWithExtension = publicIdParts[publicIdParts.length - 1];
        const filename = filenameWithExtension.split('.')[0]; // 'my_image'

        // Reconstruct the full public ID including the folder structure
        // Replace the last element (filename.ext) with just the filename
        publicIdParts[publicIdParts.length - 1] = filename;
        const publicId = publicIdParts.join('/');

        // Basic check to ensure it looks like a valid public ID
        if (publicId.includes('://')) { // Should not contain protocol
            logger.warn(`[getPublicIdFromUrl] Extracted publicId still contains protocol: ${publicId} from URL: ${url}`);
            return null;
        }

        return publicId;
    } catch (e) {
        logger.error(`[getPublicIdFromUrl] Error parsing public_id from URL: ${url}`, { error: e.message, stack: e.stack });
        return null;
    }
};

// Helper function to delete from Cloudinary using URL
const deleteFromCloudinaryByUrl = async (url) => {
    const publicId = getPublicIdFromUrl(url);
    if (!publicId) {
        logger.warn(`[deleteFromCloudinaryByUrl] Attempted to delete with an invalid URL or publicId extracted: ${url}`);
        return;
    }
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        if (result.result === 'ok') {
            logger.info(`[deleteFromCloudinaryByUrl] Successfully deleted Cloudinary asset: ${publicId}`);
        } else {
            // Log if Cloudinary reports an issue other than 'not found'
            if (result.result !== 'not found') {
                 logger.warn(`[deleteFromCloudinaryByUrl] Cloudinary reported issue deleting ${publicId}: ${result.result}`);
            } else {
                 logger.debug(`[deleteFromCloudinaryByUrl] Cloudinary asset not found, skipping deletion: ${publicId}`);
            }
        }
    } catch (error) {
        logger.error(`[deleteFromCloudinaryByUrl] Error deleting Cloudinary asset ${publicId}:`, { error: error.message, stack: error.stack });
    }
};

// GET /api/listings
exports.getListings = async (req, res, next) => {
    try {
        const {
          page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'DESC',
          type, priceMin, priceMax, roomsMin, location, search,
        } = req.query;

        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const parsedLimit = parseInt(limit, 10);

        let whereClause = { status: 'active' };

        if (type) whereClause.type = type;
        if (priceMin && priceMax) whereClause.price = { [Op.between]: [parseFloat(priceMin), parseFloat(priceMax)] };
        else if (priceMin) whereClause.price = { [Op.gte]: parseFloat(priceMin) };
        else if (priceMax) whereClause.price = { [Op.lte]: parseFloat(priceMax) };
        if (roomsMin) whereClause.rooms = { [Op.gte]: parseInt(roomsMin, 10) };
        if (location) whereClause.location = { [Op.iLike]: `%${location}%` };
        if (search) {
          whereClause[Op.or] = [
            { title: { [Op.iLike]: `%${search}%` } },
            { description: { [Op.iLike]: `%${search}%` } },
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

        res.status(200).json({
          totalItems: count,
          totalPages: Math.ceil(count / parsedLimit),
          currentPage: parseInt(page, 10),
          listings,
        });

    } catch (error) {
        logger.error('Error fetching listings:', { error: error.message, stack: error.stack, query: req.query });
        next(error);
    }
};

// POST /api/listings
exports.createListing = async (req, res, next) => {
    const owner_id = req.user.id;
    const { title, description, price, rooms, area, location, amenities, type, latitude, longitude } = req.body;
    const files = req.files || [];

    // multer-storage-cloudinary gives us `path`, which is the full URL
    const photoUrls = files.map(file => file.path);

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
          status: 'pending',
          photos: photoUrls.length > 0 ? photoUrls : null
        });

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
          listing: newListing
        });

    } catch (error) {
        logger.error('Error creating listing:', { userId: owner_id, body: req.body, error: error.message, stack: error.stack });
        if (photoUrls.length > 0) {
            logger.warn('[createListing] DB error. Cleaning up uploaded Cloudinary files...');
            for (const url of photoUrls) {
                await deleteFromCloudinaryByUrl(url);
            }
        }
        next(error);
    }
};

// PUT /api/listings/:id
exports.updateListing = async (req, res, next) => {
    const listingId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { photoManifest: photoManifestRaw, status, ...restOfBody } = req.body;
    const newlyUploadedFiles = req.files || [];
    const newPhotoUrls = newlyUploadedFiles.map(file => file.path);

    try {
        const listingToUpdate = await Listing.unscoped().findByPk(listingId);
        if (!listingToUpdate) {
            if (newPhotoUrls.length > 0) {
                logger.warn('[updateListing] Listing not found. Cleaning up newly uploaded Cloudinary files...');
                for (const url of newPhotoUrls) { await deleteFromCloudinaryByUrl(url); }
            }
            return res.status(404).json({ message: 'Listing not found.' });
        }

        if (listingToUpdate.owner_id !== userId && userRole !== 'admin') {
            if (newPhotoUrls.length > 0) {
                logger.warn('[updateListing] Unauthorized update attempt. Cleaning up newly uploaded Cloudinary files...');
                for (const url of newPhotoUrls) { await deleteFromCloudinaryByUrl(url); }
            }
            return res.status(403).json({ message: 'You do not have permission to update this listing.' });
        }

        const updateData = {
          title: restOfBody.title,
          description: restOfBody.description,
          price: restOfBody.price === '' ? null : parseFloat(restOfBody.price),
          rooms: restOfBody.rooms === '' ? null : parseInt(restOfBody.rooms, 10),
          area: restOfBody.area === '' ? null : parseFloat(restOfBody.area),
          location: restOfBody.location,
          amenities: restOfBody.amenities || null,
          type: restOfBody.type,
          latitude: restOfBody.latitude === '' ? null : parseFloat(restOfBody.latitude),
          longitude: restOfBody.longitude === '' ? null : parseFloat(restOfBody.longitude),
        };

        let finalPhotoUrls = [];
        const oldPhotoUrls = listingToUpdate.photos || [];

        if (photoManifestRaw) {
            const photoManifest = JSON.parse(photoManifestRaw);
            let newUrlIndex = 0;
            photoManifest.forEach(item => {
                if (item === '__NEW_PHOTO__') {
                    if (newUrlIndex < newPhotoUrls.length) {
                        finalPhotoUrls.push(newPhotoUrls[newUrlIndex]);
                        newUrlIndex++;
                    } else {
                        logger.warn(`[UpdateListing] Manifest inconsistency: Expected '__NEW_PHOTO__', but no more uploaded files available. Listing ID: ${listingId}`);
                    }
                } else if (oldPhotoUrls.includes(item)) { // Only include existing photos that are in the manifest
                    finalPhotoUrls.push(item);
                }
            });
            // Add any newly uploaded files that were not explicitly referenced in the manifest
            while (newUrlIndex < newPhotoUrls.length) {
                logger.warn(`[UpdateListing] Newly uploaded file ${newPhotoUrls[newUrlIndex]} was not referenced in photoManifest for listing ${listingId}. It will be added to the list.`);
                finalPhotoUrls.push(newPhotoUrls[newUrlIndex]);
                newUrlIndex++;
            }

        } else if (newPhotoUrls.length > 0) {
             // If new files uploaded but no manifest, append them to existing photos
             logger.warn(`[UpdateListing] No photoManifest received, but new files were uploaded for listing ${listingId}. Appending new files to existing ones.`);
             finalPhotoUrls = [...oldPhotoUrls, ...newPhotoUrls];
        } else {
            // No new files and no manifest (or empty manifest means remove all)
            if (photoManifestRaw && JSON.parse(photoManifestRaw).length === 0) {
                 finalPhotoUrls = []; // No photos
            } else {
                 finalPhotoUrls = oldPhotoUrls; // Keep existing photos
            }
        }

        // Determine which old photos are no longer in the final list and need to be deleted
        const urlsToDelete = oldPhotoUrls.filter(url => !finalPhotoUrls.includes(url));
        if (urlsToDelete.length > 0) {
            logger.info(`[UpdateListing] Deleting ${urlsToDelete.length} old photos from Cloudinary for listing ${listingId}.`);
            for (const url of urlsToDelete) {
                await deleteFromCloudinaryByUrl(url);
            }
        }
        
        updateData.photos = finalPhotoUrls.length > 0 ? finalPhotoUrls : null;

        let finalStatus = listingToUpdate.status; // Default to current status

        // Admin can set the status directly
        if (userRole === 'admin' && status) {
            if (['active', 'pending', 'archived', 'rejected'].includes(status)) {
                updateData.status = status;
                finalStatus = status;
            } else {
                if (newPhotoUrls.length > 0) {
                    logger.warn('[updateListing] Admin provided invalid status, cleaning up newly uploaded Cloudinary files...');
                    for (const url of newPhotoUrls) { await deleteFromCloudinaryByUrl(url); }
                }
                return res.status(400).json({ message: 'Invalid status provided by admin.' });
            }
        } else if (userRole !== 'admin' && listingToUpdate.status !== 'pending') {
            // If owner edits, set status to 'pending' for re-approval, unless it's already pending.
            updateData.status = 'pending';
            finalStatus = 'pending';
        }

        const updatedListing = await listingToUpdate.update(updateData);

        // Emit socket event if status changed to 'pending'
        if (finalStatus === 'pending' && listingToUpdate.status !== 'pending') {
            const io = req.app.get('socketio');
            if (io) {
                io.to('admin_room').emit('admin_pending_count_changed', {
                    message: `Listing '${updatedListing.title}' was updated and now requires approval.`,
                    listingId: updatedListing.id,
                });
                logger.info(`Emitted 'admin_pending_count_changed' to admin_room for listing ${updatedListing.id} after edit.`);
            }
        } else if (userRole === 'admin' && finalStatus !== listingToUpdate.status) {
            const io = req.app.get('socketio');
            if (io) {
                io.to('admin_room').emit('admin_listing_status_updated', {
                    message: `Listing '${updatedListing.title}' (ID: ${updatedListing.id}) status changed to '${finalStatus}'.`,
                    listingId: updatedListing.id,
                    newStatus: finalStatus,
                });
                logger.info(`Emitted 'admin_listing_status_updated' to admin_room for listing ${updatedListing.id} (status changed by admin to ${finalStatus}).`);
            }
        }


        res.status(200).json({
          message: 'Listing updated successfully!',
          listing: updatedListing
        });

    } catch (error) {
        logger.error('Error updating listing:', { listingId, userId, body: req.body, error: error.message, stack: error.stack });
        if (newPhotoUrls.length > 0) {
            logger.warn('[updateListing] DB error. Cleaning up newly uploaded Cloudinary files...');
            for (const url of newPhotoUrls) { await deleteFromCloudinaryByUrl(url); }
        }
        next(error);
    }
};

// DELETE /api/listings/:id
exports.deleteListing = async (req, res, next) => {
    const listingId = req.params.id;
    const userId = req.user.id;
    try {
        const listing = await Listing.unscoped().findOne({
            where: { id: listingId, owner_id: userId }
        });
        if (!listing) {
            logger.warn(`Listing ${listingId} not found or user ${userId} does not have permission to delete.`);
            return res.status(404).json({ message: 'Listing not found or you do not have permission to delete it.' });
        }

        if (listing.photos && listing.photos.length > 0) {
            for (const url of listing.photos) {
                await deleteFromCloudinaryByUrl(url);
            }
        }

        await listing.destroy();
        res.status(200).json({ message: 'Listing deleted successfully.' });
    } catch (error) {
        logger.error('Error deleting listing:', { listingId, userId, error: error.message, stack: error.stack });
        next(error);
    }
};

// Other controller functions (getListingById, getReviews, etc.) can remain largely the same,
// but ensure they are not trying to construct file paths. They should just return the `photos` array as is.
// Here are the remaining functions, checked for compatibility.

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
        { model: User, as: 'Owner', attributes: ['id', 'name', 'email', 'profile_photo_url'] }
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
    const listings = await Listing.unscoped().findAll({
      where: {
        owner_id: ownerId
      },
      order: [['created_at', 'DESC']],
      include: [{ model: Analytics, attributes: ['views_count'] }]
    });
    res.status(200).json(listings);
  } catch (error) {
    logger.error('Error fetching owner listings:', { ownerId, error: error.message, stack: error.stack });
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
    res.status(200).json(listing);
  } catch (error) {
    logger.error('Error fetching listing for edit:', { listingId, userId, error: error.message, stack: error.stack });
    next(error);
  }
};

exports.toggleListingArchiveStatus = async (req, res, next) => {
  const listingId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  const { status: requestedStatus } = req.body;

  try {
    const listing = await Listing.unscoped().findByPk(listingId);

    if (!listing) {
      logger.warn(`Listing ${listingId} not found for archive status update.`);
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const isOwner = listing.owner_id === userId;
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin) {
      logger.warn(`User ${userId} (role: ${userRole}) attempted to change archive status of listing ${listingId} they don't own.`);
      return res.status(403).json({ message: 'You do not have permission to change the archive status of this listing.' });
    }

    let finalStatus = listing.status;
    let statusChanged = false;

    if (isAdmin) {
      // Admin can set any valid status
      if (['active', 'pending', 'archived', 'rejected'].includes(requestedStatus) && requestedStatus !== listing.status) {
          finalStatus = requestedStatus;
          statusChanged = true;
      } else if (!['active', 'pending', 'archived', 'rejected'].includes(requestedStatus)) {
           return res.status(400).json({ message: 'Invalid status provided by admin.' });
      }
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

    if (!statusChanged) {
         return res.status(200).json({ message: 'Listing status is already the requested status or request was invalid.', listing });
    }

    await listing.update({ status: finalStatus });

    const io = req.app.get('socketio');
    if (io) {
        if (finalStatus === 'pending') {
             io.to('admin_room').emit('admin_pending_count_changed', {
                 message: `Listing '${listing.title}' (ID: ${listing.id}) was unarchived and needs approval.`,
                 listingId: listing.id,
             });
             logger.info(`Emitted 'admin_pending_count_changed' to admin_room for listing ${listing.id} (status changed to pending).`);
        } else if (isAdmin && ['active', 'rejected', 'archived'].includes(finalStatus)) {
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
    // Use spread operator to combine price conditions
    if (priceMin) {
    whereClause.price = { ...whereClause.price, [Op.gte]: parseFloat(priceMin) };}
    if (priceMax) {
    whereClause.price = { ...whereClause.price, [Op.lte]: parseFloat(priceMax) };
}
    if (roomsMin) whereClause.rooms = { [Op.gte]: parseInt(roomsMin, 10) };

    if (location) whereClause.location = { [Op.iLike]: `%${location}%` };
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
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
        'photos',
        'location',
        'rooms'
      ]
    });
    res.status(200).json(listings);

  } catch (error) {
    logger.error('Error fetching map data listings:', { query: req.query, error: error.message, stack: error.stack });
    next(error);
  }
};