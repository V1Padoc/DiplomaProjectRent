// backend/controllers/listingController.js

const { Op } = require('sequelize');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Review = require('../models/Review');
const path = require('path');
const fs = require('fs').promises; // Use promises version of fs
const Booking = require('../models/Booking');
const Analytics = require('../models/Analytics'); // Ensure Analytics is imported
const sharp = require('sharp'); // Import sharp for image processing
const logger = require('../config/logger'); // Import Winston logger

// Helper function for image processing
async function processImage(filePath, outputFilename, isProfilePhoto = false) {
  const tempFilePath = filePath; // Multer saves to uploadDir with a unique name
  const processedFilePath = path.join(path.dirname(tempFilePath), outputFilename); // Save with new name

  const MAX_WIDTH = isProfilePhoto ? 400 : 1200; // Different max widths
  const MAX_HEIGHT = isProfilePhoto ? 400 : 1200;
  const QUALITY = isProfilePhoto ? 80 : 75; // Slightly higher quality for profile

  try {
    await sharp(tempFilePath)
      .resize(MAX_WIDTH, MAX_HEIGHT, {
        fit: sharp.fit.inside, // Resize while maintaining aspect ratio, fitting within dimensions
        withoutEnlargement: true, // Don't enlarge if image is smaller than MAX_WIDTH/MAX_HEIGHT
      })
      .jpeg({ quality: QUALITY, progressive: true }) // Convert to JPEG, set quality
      .toFile(processedFilePath);

    // Delete the original (unprocessed) file uploaded by Multer if processing was successful
    // and the output filename is different (it should be, to avoid conflict if processing fails partway)
    if (filePath !== processedFilePath) {
        await fs.unlink(tempFilePath);
    }
    return path.basename(processedFilePath); // Return only the filename
  } catch (error) {
    logger.error(`Error processing image ${path.basename(tempFilePath)}:`, { error: error.message, stack: error.stack });
    // If processing fails, we might want to delete the original (tempFilePath) if it still exists.
    try {
        // Attempt to delete the temporary file if it still exists
        await fs.unlink(tempFilePath);
        logger.warn(`Cleaned up temporary file ${path.basename(tempFilePath)} after processing error.`);
    } catch (e) {
        if (e.code !== 'ENOENT') { // Ignore if file simply didn't exist to begin with
            logger.warn(`Could not clean up temporary file ${path.basename(tempFilePath)}:`, e.message);
        }
    }
    throw new Error(`Failed to process image: ${path.basename(tempFilePath)}`);
  }
}


exports.getListings = async (req, res, next) => { // <--- ADDED next
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
    logger.error('Error fetching listings:', { error: error.message, stack: error.stack });
    next(error); // <--- Use next(error)
  }
};

exports.createListing = async (req, res, next) => { // <--- ADDED next
  const owner_id = req.user.id;
  const { title, description, price, rooms, area, location, amenities, type, latitude, longitude } = req.body;
  
  let processedPhotoFilenames = [];
  if (req.files && req.files.length > 0) {
    try {
      for (const file of req.files) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalExt = path.extname(file.originalname);
        const extension = originalExt ? originalExt.toLowerCase() : '.jpg';
        const processedFilename = `listing-${owner_id}-${uniqueSuffix}${extension}`;
        
        const finalFilename = await processImage(file.path, processedFilename);
        processedPhotoFilenames.push(finalFilename);
      }
    } catch (processingError) {
      logger.error("Error during image processing in createListing:", { error: processingError.message, stack: processingError.stack });
      // If processing fails, this is a critical error for the request,
      // but ensure cleanup of any partially processed files if necessary.
      // processImage already handles deletion of original multer file.
      next(processingError); // <--- Pass the processing error to the centralized handler
      return; // Stop execution here
    }
  }

  try {
    const newListing = await Listing.create({
      owner_id: owner_id,
      title: title,
      description: description,
      price: parseFloat(price),
      rooms: rooms !== undefined && rooms !== '' ? parseInt(rooms, 10) : null,
      area: area !== undefined && area !== '' ? parseFloat(area) : null,
      location: location,
      latitude: latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null,
      longitude: longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null,
      amenities: amenities || null,
      type: type,
      status: 'pending',
      photos: processedPhotoFilenames.length > 0 ? processedPhotoFilenames : null
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
    logger.error('Error creating listing:', { error: error.message, stack: error.stack });
    // If listing creation fails (e.g., DB error) after images were processed, clean up.
    if (processedPhotoFilenames.length > 0) {
        const uploadDir = path.join(__dirname, '../uploads');
        for (const filename of processedPhotoFilenames) {
            try {
                await fs.unlink(path.join(uploadDir, filename));
                logger.warn(`Cleaned up processed image ${filename} due to listing creation DB error.`);
            } catch (e) {
                logger.warn(`Could not clean up processed image ${filename}:`, e.message);
            }
        }
    }
    next(error); // <--- Use next(error)
  }
};


exports.getListingById = async (req, res, next) => { // <--- ADDED next
  const listingId = req.params.id;

  logger.debug("\n--- getListingById Controller START ---");
  logger.debug(`Timestamp: ${new Date().toISOString()}`);
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
      logger.debug(`ADMIN Scoped Query: Fetching listing ID ${listingId} (owner ID: ${req.user.id})`);
      listing = await Listing.unscoped().findOne(queryOptions); 
    } else {
      queryOptions.where.status = 'active'; 
      logger.debug(`PUBLIC Scoped Query: Fetching listing ID ${listingId}. Query with status='active':`, JSON.stringify(queryOptions.where));
      listing = await Listing.findOne(queryOptions);
    }

    if (!listing) {
      const message = isAdmin ? `Listing ID ${listingId} not found (admin view).` : `Listing ID ${listingId} not found or is not active.`;
      logger.info(message);
      return res.status(404).json({ message: message });
    }

    if (listing.status === 'active') {
        try {
            const [analyticsEntry, created] = await Analytics.findOrCreate({
                where: { listing_id: listingId },
                defaults: { listing_id: listingId, views_count: 1 }
            });
            if (!created) {
                await analyticsEntry.increment('views_count');
            }
        } catch (analyticsError) {
            logger.error('Error updating views count:', { error: analyticsError.message, stack: analyticsError.stack });
        }
    }
    logger.debug(`--- getListingById Controller END (Success) ---\n`);
    res.status(200).json(listing);

  } catch (error) {
    logger.error('Error in getListingById:', { error: error.message, stack: error.stack });
    if (error.name === 'SequelizeDatabaseError' && error.original && error.original.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
        logger.warn(`--- getListingById Controller END (Error: Invalid ID Format) ---`);
        return res.status(400).json({ message: 'Invalid listing ID format.' });
    }
    next(error); // <--- Use next(error)
  }
};

exports.getReviewsByListingId = async (req, res, next) => { // <--- ADDED next
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
    logger.error('Error fetching reviews:', { error: error.message, stack: error.stack });
    next(error); // <--- Use next(error)
  }
};

exports.createReview = async (req, res, next) => { // <--- ADDED next
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
    logger.error('Error creating review:', { error: error.message, stack: error.stack });
    next(error); // <--- Use next(error)
  }
};

exports.getOwnerListings = async (req, res, next) => { // <--- ADDED next
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
    logger.error('Error fetching owner listings:', { error: error.message, stack: error.stack });
    next(error); // <--- Use next(error)
  }
};

exports.deleteListing = async (req, res, next) => { // <--- ADDED next
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
      return res.status(404).json({ message: 'Listing not found or you do not have permission to delete it.' });
    }
    if (listing.photos && listing.photos.length > 0) {
        const uploadDir = path.join(__dirname, '../uploads');
        for (const filename of listing.photos) {
            const filePath = path.join(uploadDir, filename);
            try {
                await fs.unlink(filePath);
            } catch (fileError) {
                logger.error(`Error deleting file ${filePath}:`, { error: fileError.message, stack: fileError.stack });
            }
        }
    }
    await listing.destroy();
    res.status(200).json({ message: 'Listing deleted successfully.' });
  } catch (error) {
    logger.error('Error deleting listing:', { error: error.message, stack: error.stack });
    next(error); // <--- Use next(error)
  }
};

exports.getListingForEdit = async (req, res, next) => { // <--- ADDED next
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
      return res.status(404).json({ message: 'Listing not found.' });
    }
    if (listing.owner_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to edit this listing.' });
    }
    res.status(200).json(listing);
  } catch (error) {
    logger.error('Error fetching listing for edit:', { error: error.message, stack: error.stack });
    next(error); // <--- Use next(error)
  }
};

exports.updateListing = async (req, res, next) => { // <--- ADDED next
  const listingId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  const { photoManifest: photoManifestRaw, ...restOfBody } = req.body;
  
  let newlyProcessedServerFilenames = [];
  if (req.files && req.files.length > 0) {
    try {
      for (const file of req.files) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalExt = path.extname(file.originalname);
        const extension = originalExt ? originalExt.toLowerCase() : '.jpg';
        const processedFilename = `listing-${userId}-${uniqueSuffix}${extension}`; 
        
        const finalFilename = await processImage(file.path, processedFilename);
        newlyProcessedServerFilenames.push(finalFilename);
      }
    } catch (processingError) {
      logger.error("Error during image processing in updateListing:", { error: processingError.message, stack: processingError.stack });
      next(processingError); // <--- Pass the processing error to the centralized handler
      return;
    }
  }

  try {
    const listingToUpdate = await Listing.unscoped().findByPk(listingId);
    if (!listingToUpdate) {
      if (newlyProcessedServerFilenames.length > 0) {
        const uploadDir = path.join(__dirname, '../uploads');
        for (const filename of newlyProcessedServerFilenames) {
          try { await fs.unlink(path.join(uploadDir, filename)); } catch (e) { logger.warn(`Cleanup failed for ${filename}:`, e.message); }
        }
      }
      return res.status(404).json({ message: 'Listing not found.' });
    }
    if (listingToUpdate.owner_id !== userId && userRole !== 'admin') {
      if (newlyProcessedServerFilenames.length > 0) {
        const uploadDir = path.join(__dirname, '../uploads');
        for (const filename of newlyProcessedServerFilenames) {
          try { await fs.unlink(path.join(uploadDir, filename)); } catch (e) { logger.warn(`Cleanup failed for ${filename}:`, e.message); }
        }
      }
      return res.status(403).json({ message: 'You do not have permission to update this listing.' });
    }

    const updateData = {
      title: restOfBody.title || listingToUpdate.title,
      description: restOfBody.description || listingToUpdate.description,
      price: restOfBody.price ? parseFloat(restOfBody.price) : listingToUpdate.price,
      rooms: restOfBody.rooms !== undefined && restOfBody.rooms !== '' ? parseInt(restOfBody.rooms, 10) : null,
      area: restOfBody.area !== undefined && restOfBody.area !== '' ? parseFloat(restOfBody.area) : null,
      location: restOfBody.location || listingToUpdate.location,
      amenities: restOfBody.amenities || listingToUpdate.amenities,
      type: restOfBody.type || listingToUpdate.type,
      latitude: restOfBody.latitude !== undefined && restOfBody.latitude !== '' ? parseFloat(restOfBody.latitude) : null,
      longitude: restOfBody.longitude !== undefined && restOfBody.longitude !== '' ? parseFloat(restOfBody.longitude) : null,
    };

    let finalPhotoArrayForDb = [];
    const oldPhotoFilenamesInDb = listingToUpdate.photos || [];

    if (photoManifestRaw) {
        const parsedPhotoManifest = JSON.parse(photoManifestRaw);
        let newFileIdx = 0; 

        for (const manifestItem of parsedPhotoManifest) {
            if (manifestItem === '__NEW_PHOTO__') {
                if (newFileIdx < newlyProcessedServerFilenames.length) {
                    finalPhotoArrayForDb.push(newlyProcessedServerFilenames[newFileIdx]);
                    newFileIdx++;
                } else {
                    logger.warn(`[UpdateListing] Manifest inconsistency: Expected '__NEW_PHOTO__', but no more uploaded files available.`);
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
                    logger.info(`[UpdateListing] Deleted old photo from storage: ${filename}`);
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

    } else if (newlyProcessedServerFilenames.length > 0) {
        logger.warn("[UpdateListing] No photoManifest received, but new files were uploaded. Appending new files to existing ones.");
        updateData.photos = [...oldPhotoFilenamesInDb, ...newlyProcessedServerFilenames];
    } else {
        updateData.photos = oldPhotoFilenamesInDb.length > 0 ? oldPhotoFilenamesInDb : null;
    }

    const updatedListingInstance = await listingToUpdate.update(updateData);
    let finalStatus = updatedListingInstance.status;

    if (userRole !== 'admin' && updatedListingInstance.status !== 'pending') {
        await updatedListingInstance.update({ status: 'pending' });
        finalStatus = 'pending'; 
    } else if (userRole === 'admin' && restOfBody.status && restOfBody.status !== updatedListingInstance.status) {
        await updatedListingInstance.update({status: restOfBody.status });
        finalStatus = restOfBody.status;
    }
    
    if (finalStatus === 'pending') {
        const io = req.app.get('socketio');
        if (io) {
            io.to('admin_room').emit('admin_new_pending_listing', { 
                message: `Listing '${updatedListingInstance.title}' was updated and now requires approval.`,
                listingId: updatedListingInstance.id,
            });
            logger.info(`Emitted 'admin_new_pending_listing' (or similar) to admin_room for listing ${updatedListingInstance.id} after edit by owner.`);
        }
    }

    res.status(200).json({
      message: 'Listing updated successfully!',
      listing: {
        id: updatedListingInstance.id,
        title: updatedListingInstance.title,
        owner_id: updatedListingInstance.owner_id,
        status: updatedListingInstance.status,
        photos: updatedListingInstance.photos, 
        latitude: updatedListingInstance.latitude,
        longitude: updatedListingInstance.longitude
      }
    });

  } catch (error) {
    logger.error('Error updating listing:', { error: error.message, stack: error.stack });
    if (newlyProcessedServerFilenames.length > 0) {
        const uploadDir = path.join(__dirname, '../uploads');
        for (const filename of newlyProcessedServerFilenames) {
            try {
                await fs.unlink(path.join(uploadDir, filename));
                logger.warn(`Cleaned up newly processed image ${filename} due to listing update error.`);
            } catch (e) {
                logger.warn(`Could not clean up newly processed image ${filename}:`, e.message);
            }
        }
    }
    next(error); // <--- Use next(error)
  }
};

exports.getListingBookedDates = async (req, res, next) => { // <--- ADDED next
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
        logger.error("Error fetching booked dates:", { error: error.message, stack: error.stack });
        next(error); // <--- Use next(error)
    }
};

exports.getMapData = async (req, res, next) => { // <--- ADDED next
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
    logger.error('Error fetching map data listings:', { error: error.message, stack: error.stack });
    next(error); // <--- Use next(error)
  }
};