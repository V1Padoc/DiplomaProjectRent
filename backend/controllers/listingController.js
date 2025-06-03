// backend/controllers/listingController.js

const { Op } = require('sequelize');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Review = require('../models/Review');
const path = require('path');
const fs = require('fs').promises;
const Booking = require('../models/Booking');
const Analytics = require('../models/Analytics'); // Ensure Analytics is imported
const logger = require('../config/logger'); // Import Winston logger

exports.getListings = async (req, res, next) => { // Added 'next'
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

exports.createListing = async (req, res, next) => { // Added 'next'
  const owner_id = req.user.id;
  // Fields are now validated by createListingValidationRules middleware
  const { title, description, price, rooms, area, location, amenities, type, latitude, longitude } = req.body;
  const photoFilenames = req.files ? req.files.map(file => file.filename) : [];

  try {
    // Removed: if (!title || !price || !location || !type) validation is now handled by express-validator
    const newListing = await Listing.create({
      owner_id: owner_id,
      title: title,
      description: description,
      price: parseFloat(price), // Still need to convert as express-validator returns string
      rooms: rooms ? parseInt(rooms, 10) : null, // Still need to convert
      area: area ? parseFloat(area) : null, // Still need to convert
      location: location,
      latitude: latitude ? parseFloat(latitude) : null, // Still need to convert
      longitude: longitude ? parseFloat(longitude) : null, // Still need to convert
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
    next(error); // Pass to centralized error handler
  }
};

// backend/controllers/listingController.js
exports.getListingById = async (req, res, next) => { // Added 'next'
  const listingId = req.params.id;

  logger.debug("\n--- getListingById Controller START ---");
  logger.debug(`Requested Listing ID: ${listingId} (type: ${typeof listingId})`);

  let isAdmin = false;
  if (req.user && typeof req.user === 'object' && req.user.role === 'admin') {
    isAdmin = true;
  }

  logger.debug("req.user (from middleware):", req.user ? {id: req.user.id, role: req.user.role, name: req.user.name} : 'undefined');
  logger.debug(`Calculated 'isAdmin': ${isAdmin}`);

  try {
    let queryOptions = {
      where: { id: listingId },
      include: [
        {
          model: User,
          as: 'Owner',
          attributes: ['id', 'name', 'email', 'profile_photo_url']
        }
      ]
    };

    let listing;

    if (isAdmin) {
      logger.debug(`ADMIN Scoped Query: Fetching listing ID ${listingId}`);
      listing = await Listing.unscoped().findOne(queryOptions);
    } else {
      queryOptions.where.status = 'active'; // Add status constraint
      logger.debug(`PUBLIC Scoped Query: Fetching listing ID ${listingId}. Query with status='active':`, JSON.stringify(queryOptions.where));
      listing = await Listing.findOne(queryOptions);
    }

    if (!listing) {
      const message = isAdmin ? `Listing ID ${listingId} not found (admin view).` : `Listing ID ${listingId} not found or is not active.`;
      logger.info(message);
      return res.status(404).json({ message: message });
    }

    // Increment views count only for active listings
    if (listing.status === 'active') {
        try {
            const [analyticsEntry, created] = await Analytics.findOrCreate({
                where: { listing_id: listingId },
                defaults: { listing_id: listingId, views_count: 1 }
            });
            if (!created) {
                await analyticsEntry.increment('views_count');
            }
            logger.debug(`Views count updated for listing ${listingId}`);
        } catch (analyticsError) {
            logger.error('Error updating views count:', { listingId, error: analyticsError.message, stack: analyticsError.stack });
            // Non-critical, so don't fail the main request
        }
    }
    logger.debug(`--- getListingById Controller END (Success) ---\n`);
    res.status(200).json(listing);

  } catch (error) {
    logger.error('Error in getListingById:', { listingId, error: error.message, stack: error.stack });
    // This specific error check might be redundant if ID validation is robust.
    if (error.name === 'SequelizeDatabaseError' && error.original && error.original.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
        logger.warn(`--- getListingById Controller END (Error: Invalid ID Format) ---\n`);
        return res.status(400).json({ message: 'Invalid listing ID format.' });
    }
    logger.debug(`--- getListingById Controller END (Error: Server Error) ---\n`);
    next(error); // Pass to centralized error handler
  }
};

exports.getReviewsByListingId = async (req, res, next) => { // Added 'next'
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
    next(error); // Pass to centralized error handler
  }
};

exports.createReview = async (req, res, next) => { // Added 'next'
  const listingId = req.params.listingId;
  const userId = req.user.id;
  // `rating` and `comment` are validated by express-validator
  const { rating, comment } = req.body;
  try {
    // Removed: if (rating === undefined || rating === null || rating < 1 || rating > 5) is now handled by validators
    const newReview = await Review.create({
      listing_id: listingId,
      user_id: userId,
      rating: parseInt(rating, 10), // Still need to convert
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
    next(error); // Pass to centralized error handler
  }
};

exports.getOwnerListings = async (req, res, next) => { // Added 'next'
  const ownerId = req.user.id;
  try {
    const listings = await Listing.findAll({
      where: {
        owner_id: ownerId
      },
      order: [['created_at', 'DESC']],
      include: [{ model: Analytics, attributes: ['views_count'] }]
    });
    res.status(200).json(listings);
  } catch (error) {
    logger.error('Error fetching owner listings:', { ownerId, error: error.message, stack: error.stack });
    next(error); // Pass to centralized error handler
  }
};

exports.deleteListing = async (req, res, next) => { // Added 'next'
  const listingId = req.params.id;
  const userId = req.user.id;
  try {
    const listing = await Listing.findOne({
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
            const filePath = path.join(uploadDir, filename);
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
    await listing.destroy();
    res.status(200).json({ message: 'Listing deleted successfully.' });
  } catch (error) {
    logger.error('Error deleting listing:', { listingId, userId, error: error.message, stack: error.stack });
    next(error); // Pass to centralized error handler
  }
};

exports.getListingForEdit = async (req, res, next) => { // Added 'next'
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
    next(error); // Pass to centralized error handler
  }
};

exports.updateListing = async (req, res, next) => { // Added 'next'
  const listingId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  // Fields are now validated by updateListingValidationRules middleware
  const { photoManifest: photoManifestRaw, status, ...restOfBody } = req.body; // Destructure status as well
  const newlyUploadedServerFilenames = req.files ? req.files.map(file => file.filename) : [];

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
      // These assignments now rely on express-validator having ensured type and existence for non-optional fields
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
                const filePath = path.join(uploadDir, filename);
                try {
                    await fs.access(filePath);
                    await fs.unlink(filePath);
                    logger.info(`[UpdateListing] Deleted old photo from storage: ${filename} for listing ${listingId}`);
                } catch (fileError) {
                    if (fileError.code === 'ENOENT') {
                        logger.warn(`[UpdateListing] File not found for deletion, skipping: ${filePath}`);
                    } else {
                        logger.error(`[UpdateListing] Error deleting old file ${filePath}:`, { error: fileError.message, stack: fileError.stack });
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
            io.to('admin_room').emit('admin_pending_count_changed', { // Use a more general event for admin dashboards
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
    next(error); // Pass to centralized error handler
  }
};

exports.getListingBookedDates = async (req, res, next) => { // Added 'next'
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
        next(error); // Pass to centralized error handler
    }
};

// MODIFIED getMapData to accept filters
exports.getMapData = async (req, res, next) => { // Added 'next'
  try {
    const { type, priceMin, priceMax, roomsMin, location, search } = req.query;

    let whereClause = {
      status: 'active',
      latitude: { [Op.ne]: null },
      longitude: { [Op.ne]: null }
    };

    // Apply filters similar to getListings
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
      // No pagination for map data, we want all matching markers
    });

    res.status(200).json(listings);

  } catch (error) {
    logger.error('Error fetching map data listings:', { query: req.query, error: error.message, stack: error.stack });
    next(error); // Pass to centralized error handler
  }
};