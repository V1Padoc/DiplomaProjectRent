// backend/controllers/listingController.js

const { Op } = require('sequelize');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Review = require('../models/Review');
const path = require('path');
const fs = require('fs').promises;
const Booking = require('../models/Booking');
const Analytics = require('../models/Analytics');
const logger = require('../config/logger');
const sharp = require('sharp'); // <--- ADDED

// Helper function for image processing
const processImage = async (file) => {
    const originalFilename = file.filename;
    const thumbnailFilename = `thumb-${originalFilename}`;
    
    const uploadDir = path.join(__dirname, '../uploads');
    const originalPath = path.join(uploadDir, originalFilename);
    const thumbnailPath = path.join(uploadDir, thumbnailFilename);

    try {
        await sharp(originalPath)
            .resize({
                width: 600, // A good width for a card thumbnail
                height: 450, // A good height, maintaining aspect ratio
                fit: sharp.fit.cover, // Crop to cover the dimensions
                position: sharp.strategy.entropy // Smart crop focus
            })
            .jpeg({ quality: 85 }) // Compress to JPEG with good quality
            .toFile(thumbnailPath);
            
        logger.info(`[ProcessImage] Created thumbnail: ${thumbnailFilename}`);
        return thumbnailFilename; // We will store the original filename in the DB
    } catch (error) {
        logger.error(`[ProcessImage] Failed to create thumbnail for ${originalFilename}`, { error });
        // Depending on requirements, you might want to throw the error or just return null
        return null; 
    }
};

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

// MODIFIED: createListing
exports.createListing = async (req, res, next) => {
  const owner_id = req.user.id;
  const { title, description, price, rooms, area, location, amenities, type, latitude, longitude } = req.body;
  const files = req.files || [];

  // We will process images but store the ORIGINAL filenames in the DB
  // This gives us flexibility later to generate other sizes if needed.
  const photoFilenames = files.map(file => file.filename);

  // Process images in parallel after getting filenames
  try {
      for (const file of files) {
          await processImage(file);
      }
  } catch (procError) {
      // If processing fails, we might want to stop the listing creation.
      logger.error('Critical error during image processing for new listing', { procError });
      return next(new Error('Failed to process uploaded images.'));
  }
  
  // The rest of the function remains largely the same...
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
      photos: photoFilenames.length > 0 ? photoFilenames : null
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
        photos: newListing.photos,
        latitude: newListing.latitude,
        longitude: newListing.longitude
      }
    });

  } catch (error) {
    logger.error('Error creating listing:', { userId: owner_id, body: req.body, error: error.message, stack: error.stack });
    next(error);
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
    const listings = await Listing.unscoped().findAll({ // <--- ADDED .unscoped()
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

// MODIFIED: deleteListing
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
    if (listing.photos && listing.photos.length > 0) {
        const uploadDir = path.join(__dirname, '../uploads');
        for (const filename of listing.photos) {
            const originalFilePath = path.join(uploadDir, filename);
            const thumbFilePath = path.join(uploadDir, `thumb-${filename}`); // <-- Path to thumbnail
            
            // Delete both original and thumbnail
            for (const filePath of [originalFilePath, thumbFilePath]) {
                 try {
                    await fs.unlink(filePath);
                    logger.info(`Deleted file: ${filePath}`);
                } catch (fileError) {
                    if (fileError.code === 'ENOENT') {
                        logger.warn(`File not found for deletion, skipping: ${filePath}`);
                    } else {
                        logger.error(`Error deleting file ${filePath}:`, { error: fileError.message, stack: fileError.stack });
                    }
                }
            }
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
    res.status(200).json(listing);
  } catch (error) {
    logger.error('Error fetching listing for edit:', { listingId, userId, error: error.message, stack: error.stack });
    next(error);
  }
};

// MODIFIED: updateListing
exports.updateListing = async (req, res, next) => {
  const listingId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  const { photoManifest: photoManifestRaw, status, ...restOfBody } = req.body;
  const newlyUploadedFiles = req.files || []; // <-- Get full file objects
  const newlyUploadedServerFilenames = newlyUploadedFiles.map(file => file.filename);

  // Process newly uploaded images
  try {
      for (const file of newlyUploadedFiles) {
          await processImage(file);
      }
  } catch (procError) {
      logger.error('Critical error during image processing for listing update', { procError });
      return next(new Error('Failed to process newly uploaded images.'));
  }

  try {
    const listingToUpdate = await Listing.unscoped().findByPk(listingId);
    if (!listingToUpdate) {
      logger.warn(`Listing ${listingId} not found for update.`);
      return res.status(404).json({ message: 'Listing not found.' });
    }
    if (listingToUpdate.owner_id !== userId && userRole !== 'admin') {
      logger.warn(`User ${userId} (role: ${userRole}) attempted to update listing ${listingId} they don't own.`);
      return res.status(403).json({ message: 'You do not have permission to update this listing.' });
    }

    const updateData = {
      title: restOfBody.title,
      description: restOfBody.description,
      price: parseFloat(restOfBody.price),
      rooms: restOfBody.rooms === '' ? null : parseInt(restOfBody.rooms, 10),
      area: restOfBody.area === '' ? null : parseFloat(restOfBody.area),
      location: restOfBody.location,
      amenities: restOfBody.amenities,
      type: restOfBody.type,
      latitude: restOfBody.latitude === '' ? null : parseFloat(restOfBody.latitude),
      longitude: restOfBody.longitude === '' ? null : parseFloat(restOfBody.longitude),
    };

    let finalPhotoArrayForDb = [];
    const oldPhotoFilenamesInDb = listingToUpdate.photos || [];

    if (photoManifestRaw) {
        const parsedPhotoManifest = JSON.parse(photoManifestRaw);
        let newFileIdx = 0;

        for (const manifestItem of parsedPhotoManifest) {
            if (manifestItem === '__NEW_PHOTO__') {
                if (newFileIdx < newlyUploadedServerFilenames.length) {
                    finalPhotoArrayForDb.push(newlyUploadedServerFilenames[newFileIdx]);
                    newFileIdx++;
                } else {
                    logger.warn(`[UpdateListing] Manifest inconsistency: Expected '__NEW_PHOTO__', but no more uploaded files available. Listing ID: ${listingId}`);
                }
            } else {
                finalPhotoArrayForDb.push(manifestItem);
            }
        }

        const photosToDeleteFromStorage = oldPhotoFilenamesInDb.filter(
            oldFilename => !finalPhotoArrayForDb.includes(oldFilename)
        );

        if (photosToDeleteFromStorage.length > 0) {
            const uploadDir = path.join(__dirname, '../uploads');
            for (const filename of photosToDeleteFromStorage) {
                // Also delete the thumbnail for the removed photo
                const originalFilePath = path.join(uploadDir, filename);
                const thumbFilePath = path.join(uploadDir, `thumb-${filename}`);
                
                for (const filePath of [originalFilePath, thumbFilePath]) {
                     try {
                        await fs.unlink(filePath);
                        logger.info(`[UpdateListing] Deleted old photo: ${filePath}`);
                    } catch (fileError) {
                        if (fileError.code !== 'ENOENT') {
                           logger.error(`[UpdateListing] Error deleting old file ${filePath}:`, fileError);
                        }
                    }
                }
            }
        }
        updateData.photos = finalPhotoArrayForDb.length > 0 ? finalPhotoArrayForDb : null;

    } else if (newlyUploadedServerFilenames.length > 0) {
        logger.warn(`[UpdateListing] No photoManifest received, but new files were uploaded for listing ${listingId}. Appending new files to existing ones.`);
        updateData.photos = [...oldPhotoFilenamesInDb, ...newlyUploadedServerFilenames];
    } else {
        updateData.photos = oldPhotoFilenamesInDb.length > 0 ? oldPhotoFilenamesInDb : null;
    }

    let finalStatus = listingToUpdate.status;

    // Admin can set the status directly
    if (userRole === 'admin' && status) {
        updateData.status = status;
        finalStatus = status;
    } else if (userRole !== 'admin' && listingToUpdate.status !== 'pending') {
        // If owner edits, set status to 'pending' for re-approval, unless it's already pending.
        updateData.status = 'pending';
        finalStatus = 'pending';
    }

    const updatedListing = await listingToUpdate.update(updateData);

    if (finalStatus === 'pending') {
        const io = req.app.get('socketio');
        if (io) {
            io.to('admin_room').emit('admin_pending_count_changed', {
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
        photos: updatedListing.photos,
        latitude: updatedListing.latitude,
        longitude: updatedListing.longitude
      }
    });

  } catch (error) {
    logger.error('Error updating listing:', { listingId, userId, body: req.body, error: error.message, stack: error.stack });
    next(error);
  }
};

// NEW: Controller function to toggle archive status
exports.toggleListingArchiveStatus = async (req, res, next) => {
  const listingId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  const { status: requestedStatus } = req.body; // The requested new status from frontend ('archived' or 'pending')

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

    if (isAdmin) {
      // Admin can set any valid status
      if (['active', 'pending', 'archived', 'rejected'].includes(requestedStatus)) {
          finalStatus = requestedStatus;
      } else {
          return res.status(400).json({ message: 'Invalid status provided by admin.' });
      }
    } else if (isOwner) {
      // Owner specific logic for archive/unarchive
      if (requestedStatus === 'archived') {
        // Owner can archive if listing is active, pending, or rejected
        if (['active', 'pending', 'rejected'].includes(listing.status)) {
          finalStatus = 'archived';
        } else {
          logger.warn(`Owner ${userId} attempted to archive an already archived listing ${listingId} or one in an un-archivable state.`);
          return res.status(400).json({ message: 'Listing is already archived or in a state that cannot be archived by you.' });
        }
      } else if (requestedStatus === 'pending') {
        // Owner can unarchive ONLY if listing is currently archived. Unarchiving sends to 'pending' for re-approval.
        if (listing.status === 'archived') {
          finalStatus = 'pending';
        } else {
          logger.warn(`Owner ${userId} attempted to unarchive a non-archived listing ${listingId}.`);
          return res.status(400).json({ message: 'Listing is not archived and cannot be unarchived by you.' });
        }
      } else {
        logger.warn(`Owner ${userId} attempted an invalid archive/unarchive request for listing ${listingId}: requested status ${requestedStatus}`);
        return res.status(400).json({ message: 'Invalid status request for owner. Owners can only archive or unarchive to pending.' });
      }
    }

    // If the status is not changing, return early
    if (finalStatus === listing.status) {
      return res.status(200).json({ message: 'Listing status is already the requested status.', listing });
    }

    await listing.update({ status: finalStatus });

    // Emit socket event if status changed to 'pending' (from unarchiving or owner edit)
    if (finalStatus === 'pending') {
        const io = req.app.get('socketio');
        if (io) {
            io.to('admin_room').emit('admin_new_pending_listing', { // Re-using existing event for new pending for admin dashboard
                message: `Listing '${listing.title}' (ID: ${listing.id}) was ${requestedStatus === 'archived' ? 'updated and needs re-approval' : 'unarchived and needs approval'}.`,
                listingId: listing.id,
            });
            logger.info(`Emitted 'admin_new_pending_listing' to admin_room for listing ${listing.id} (status changed to pending).`);
        }
    }

    res.status(200).json({ message: `Listing successfully ${requestedStatus === 'archived' ? 'archived' : 'unarchived to pending'}.`, listing });

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