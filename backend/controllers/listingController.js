// backend/controllers/listingController.js

const { Op } = require('sequelize');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Review = require('../models/Review');
const path = require('path');
const fs = require('fs').promises;
const Booking = require('../models/Booking');
const Analytics = require('../models/Analytics'); // Ensure Analytics is imported

exports.getListings = async (req, res) => {
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
    console.error('Error fetching listings:', error);
    res.status(500).json({ message: 'Server error while fetching listings.' });
  }
};

exports.createListing = async (req, res) => {
  const owner_id = req.user.id;
  const { title, description, price, rooms, area, location, amenities, type, latitude, longitude } = req.body;
  const photoFilenames = req.files ? req.files.map(file => file.filename) : [];

  try {
    if (!title || !price || !location || !type) {
      return res.status(400).json({ message: 'Please provide title, price, location, and type.' });
    }
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
  if (newListing.status === 'pending') { // This condition will always be true here given the above
      const io = req.app.get('socketio');
      if (io) {
        io.to('admin_room').emit('admin_new_pending_listing', { // <-- THIS IS THE CORRECT EVENT NAME
          message: `New listing '${newListing.title}' needs approval.`,
          listingId: newListing.id,
        });
        console.log(`Emitted 'admin_new_pending_listing' to admin_room for listing ${newListing.id}`);
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
    console.error('Error creating listing:', error);
    res.status(500).json({ message: 'Server error during listing creation.' });
  }
};

// backend/controllers/listingController.js
// TEMPORARY DEBUGGING VERSION of getListingById
exports.getListingById = async (req, res) => {
  const listingId = req.params.id;

  console.log("\n--- getListingById Controller START ---");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Requested Listing ID: ${listingId} (type: ${typeof listingId})`);

  // Robust check for req.user and admin role
  let isAdmin = false;
  if (req.user && typeof req.user === 'object' && req.user.role === 'admin') {
    isAdmin = true;
  }
  
  console.log("req.user (from middleware):", req.user ? {id: req.user.id, role: req.user.role, name: req.user.name} : 'undefined'); // Log the whole req.user object or null
  console.log(`Calculated 'isAdmin': ${isAdmin}`);

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
      // Admin can see listings of any status.
      console.log(`ADMIN Scoped Query: Fetching listing ID ${listingId} (owner ID: ${req.user.id})`);
      // queryOptions.where should ONLY have { id: listingId }
      // Use .unscoped() to bypass any defaultScope on Listing model
      listing = await Listing.unscoped().findOne(queryOptions); 
    } else {
      // Non-admins (or unauthenticated users) can only see 'active' listings.
      queryOptions.where.status = 'active'; // Add status constraint
      console.log(`PUBLIC Scoped Query: Fetching listing ID ${listingId}. Query with status='active':`, JSON.stringify(queryOptions.where));
      listing = await Listing.findOne(queryOptions);
    }

    // ... (rest of your function: if (!listing), analytics, res.status(200), etc.)
    if (!listing) {
      const message = isAdmin ? `Listing ID ${listingId} not found (admin view).` : `Listing ID ${listingId} not found or is not active.`;
      console.log(message);
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
        } catch (analyticsError) {
            console.error('Error updating views count:', analyticsError);
            // Non-critical, so don't fail the main request
        }
    }
    console.log(`--- getListingById Controller END (Success) ---\n`);
    res.status(200).json(listing);

  } catch (error) {
    console.error('Error in getListingById:', error);
    if (error.name === 'SequelizeDatabaseError' && error.original && error.original.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
        console.log(`--- getListingById Controller END (Error: Invalid ID Format) ---\n`);
        return res.status(400).json({ message: 'Invalid listing ID format.' });
    }
    console.log(`--- getListingById Controller END (Error: Server Error) ---\n`);
    res.status(500).json({ message: 'Server error while fetching listing.' });
  }
};

exports.getReviewsByListingId = async (req, res) => {
  const listingId = req.params.listingId;
  try {
    const reviews = await Review.findAll({
      where: { listing_id: listingId },
      order: [['created_at', 'DESC']],
      include: [{
        model: User,
        as: 'User',
        attributes: ['id', 'name', 'email', 'profile_photo_url'] // Added profile photo
      }]
    });
    res.status(200).json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Server error while fetching reviews.' });
  }
};

exports.createReview = async (req, res) => {
  const listingId = req.params.listingId;
  const userId = req.user.id;
  const { rating, comment } = req.body;
  try {
    if (rating === undefined || rating === null || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Please provide a valid rating between 1 and 5.' });
    }
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
            attributes: ['id', 'name', 'email', 'profile_photo_url'] // Added profile photo
        }]
    });
    res.status(201).json({
      message: 'Review added successfully!',
      review: reviewWithUser
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ message: 'Server error during review creation.' });
  }
};

exports.getOwnerListings = async (req, res) => {
  const ownerId = req.user.id;
  try {
    const listings = await Listing.findAll({
      where: {
        owner_id: ownerId
      },
      order: [['created_at', 'DESC']],
      include: [{ model: Analytics, attributes: ['views_count'] }] // Include Analytics
    });
    res.status(200).json(listings);
  } catch (error) {
    console.error('Error fetching owner listings:', error);
    res.status(500).json({ message: 'Server error while fetching owner listings.' });
  }
};

exports.deleteListing = async (req, res) => {
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
                console.error(`Error deleting file ${filePath}:`, fileError);
            }
        }
    }
    await listing.destroy();
    res.status(200).json({ message: 'Listing deleted successfully.' });
  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({ message: 'Server error during listing deletion.' });
  }
};

exports.getListingForEdit = async (req, res) => {
  const listingId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  try {
    // Admins should be able to fetch listings for edit regardless of status
    const listing = await Listing.unscoped().findByPk(listingId, { // Added .unscoped() here
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
    console.error('Error fetching listing for edit:', error);
    res.status(500).json({ message: 'Server error while fetching listing for edit.' });
  }
};

exports.updateListing = async (req, res) => {
  const listingId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  // Destructure photoManifestRaw directly from req.body
  const { photoManifest: photoManifestRaw, ...restOfBody } = req.body;
  const newlyUploadedServerFilenames = req.files ? req.files.map(file => file.filename) : [];

  try {
    // Admins should be able to update listings regardless of status
    const listingToUpdate = await Listing.unscoped().findByPk(listingId);
    if (!listingToUpdate) {
      return res.status(404).json({ message: 'Listing not found.' });
    }
    if (listingToUpdate.owner_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to update this listing.' });
    }

    const updateData = {
      title: restOfBody.title || listingToUpdate.title,
      description: restOfBody.description || listingToUpdate.description,
      price: restOfBody.price ? parseFloat(restOfBody.price) : listingToUpdate.price,
      // Handle number fields to be null if empty string
      rooms: restOfBody.rooms !== undefined ? (restOfBody.rooms === '' ? null : parseInt(restOfBody.rooms, 10)) : listingToUpdate.rooms,
      area: restOfBody.area !== undefined ? (restOfBody.area === '' ? null : parseFloat(restOfBody.area)) : listingToUpdate.area,
      location: restOfBody.location || listingToUpdate.location,
      amenities: restOfBody.amenities || listingToUpdate.amenities,
      type: restOfBody.type || listingToUpdate.type,
      latitude: restOfBody.latitude !== undefined ? (restOfBody.latitude === '' ? null : parseFloat(restOfBody.latitude)) : listingToUpdate.latitude,
      longitude: restOfBody.longitude !== undefined ? (restOfBody.longitude === '' ? null : parseFloat(restOfBody.longitude)) : listingToUpdate.longitude,
    };

    let finalPhotoArrayForDb = [];
    const oldPhotoFilenamesInDb = listingToUpdate.photos || [];

    if (photoManifestRaw) {
        const parsedPhotoManifest = JSON.parse(photoManifestRaw);
        let newFileIdx = 0; // Index for newlyUploadedServerFilenames

        for (const manifestItem of parsedPhotoManifest) {
            if (manifestItem === '__NEW_PHOTO__') {
                if (newFileIdx < newlyUploadedServerFilenames.length) {
                    finalPhotoArrayForDb.push(newlyUploadedServerFilenames[newFileIdx]);
                    newFileIdx++;
                } else {
                    // This case means the manifest expected a new photo, but not enough files were uploaded.
                    // This could happen if a file upload failed or was filtered by multer, but the manifest was still generated.
                    console.warn(`[UpdateListing] Manifest inconsistency: Expected '__NEW_PHOTO__', but no more uploaded files available.`);
                }
            } else {
                // This 'manifestItem' is a filename of an supposedly existing photo.
                // We trust the manifest to tell us which existing photos to keep.
                finalPhotoArrayForDb.push(manifestItem);
            }
        }
        
        // Determine photos to delete from storage:
        // These are photos that were in the DB but are NOT in the final desired array.
        const photosToDeleteFromStorage = oldPhotoFilenamesInDb.filter(
            oldFilename => !finalPhotoArrayForDb.includes(oldFilename)
        );

        if (photosToDeleteFromStorage.length > 0) {
            const uploadDir = path.join(__dirname, '../uploads');
            for (const filename of photosToDeleteFromStorage) {
                const filePath = path.join(uploadDir, filename);
                try {
                    await fs.access(filePath); // Check if file exists
                    await fs.unlink(filePath); // Delete the file
                    console.log(`[UpdateListing] Deleted old photo from storage: ${filename}`);
                } catch (fileError) {
                    if (fileError.code === 'ENOENT') {
                        console.warn(`[UpdateListing] File not found for deletion, skipping: ${filePath}`);
                    } else {
                        console.error(`[UpdateListing] Error deleting old file ${filePath}:`, fileError);
                    }
                }
            }
        }
        updateData.photos = finalPhotoArrayForDb.length > 0 ? finalPhotoArrayForDb : null;

    } else if (newlyUploadedServerFilenames.length > 0) {
        // Fallback: No manifest, but new files uploaded. Append them to existing.
        // This path should ideally not be hit if frontend always sends manifest for photo ops.
        console.warn("[UpdateListing] No photoManifest received, but new files were uploaded. Appending new files to existing ones.");
        updateData.photos = [...oldPhotoFilenamesInDb, ...newlyUploadedServerFilenames];
    } else {
        // If no photoManifestRaw and no new files, assume user wants to keep existing photos as is.
        updateData.photos = oldPhotoFilenamesInDb.length > 0 ? oldPhotoFilenamesInDb : null;
    }

    const updatedListing = await listingToUpdate.update(updateData);

    const updatedListingInstance = await listingToUpdate.update(updateData);
     let finalStatus = updatedListingInstance.status;
    // If owner edits, set status to 'pending' for re-approval, unless it's an admin.
    // This logic can be more nuanced based on which fields are changed.
    if (userRole !== 'admin' && updatedListingInstance.status !== 'pending') {
        await updatedListingInstance.update({ status: 'pending' });
        finalStatus = 'pending'; // Update finalStatus if changed
    } else if (userRole === 'admin' && restOfBody.status && restOfBody.status !== updatedListingInstance.status) {
        // If admin explicitly sets a new status
        await updatedListingInstance.update({status: restOfBody.status });
        finalStatus = restOfBody.status;
    }
 if (finalStatus === 'pending') {
        const io = req.app.get('socketio');
        if (io) {
            io.to('admin_room').emit('admin_new_pending_listing', { // Or 'admin_pending_count_changed'
                message: `Listing '${updatedListingInstance.title}' was updated and now requires approval.`,
                listingId: updatedListingInstance.id,
            });
            console.log(`Emitted 'admin_new_pending_listing' (or similar) to admin_room for listing ${updatedListingInstance.id} after edit by owner.`);
        }
    }

    res.status(200).json({
      message: 'Listing updated successfully!',
      listing: {
        id: updatedListing.id,
        title: updatedListing.title,
        owner_id: updatedListing.owner_id,
        status: updatedListing.status,
        photos: updatedListing.photos, // Ensure photos are part of the response
        latitude: updatedListing.latitude,
        longitude: updatedListing.longitude
      }
    });

  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ message: 'Server error during listing update.' });
  }
};

exports.getListingBookedDates = async (req, res) => {
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
        console.error("Error fetching booked dates:", error);
        res.status(500).json({ message: "Server error while fetching booked dates." });
    }
};

// MODIFIED getMapData to accept filters
exports.getMapData = async (req, res) => {
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
      // Ensure search is applied to title and description for map data as well
      // If you want search to affect other fields for map data, add them here.
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        // Potentially add location to search criteria here if distinct from location filter
        // { location: { [Op.like]: `%${search}%` } }
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
        'location', // For popup
        'rooms' // Good to have for tooltip/popup
      ]
      // No pagination for map data, we want all matching markers
    });

    res.status(200).json(listings);

  } catch (error) {
    console.error('Error fetching map data listings:', error);
    res.status(500).json({ message: 'Server error while fetching map data.' });
  }
};