// backend/controllers/listingController.js

const { Op } = require('sequelize');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Review = require('../models/Review');
const path = require('path');
const fs = require('fs').promises;
const Booking = require('../models/Booking');
const Analytics = require('../models/Analytics'); // Ensure Analytics is imported

// ... (getListings, createListing, getListingById, etc. remain mostly the same) ...
// ... (Make sure all existing functions are present)

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

exports.getListingById = async (req, res) => {
  const listingId = req.params.id;
  try {
    const listing = await Listing.findOne({
      where: {
         id: listingId,
         status: 'active'
      },
      include: [
        {
          model: User,
          as: 'Owner',
          attributes: ['id', 'name', 'email', 'profile_photo_url']
        }
      ]
    });

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found or is not active.' });
    }

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
    }

    res.status(200).json(listing);

  } catch (error) {
    console.error('Error fetching listing by ID:', error);
    if (error.name === 'SequelizeDatabaseError' && error.original && error.original.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
        return res.status(400).json({ message: 'Invalid listing ID format.' });
    }
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
    const listing = await Listing.findByPk(listingId, {
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
  const { title, description, price, rooms, area, location, amenities, type, latitude, longitude } = req.body;
  const newPhotoFilenames = req.files ? req.files.map(file => file.filename) : [];
  const existingPhotosToKeep = Array.isArray(req.body.existingPhotos) ? req.body.existingPhotos : (req.body.existingPhotos ? [req.body.existingPhotos] : []);

  try {
    const listing = await Listing.findByPk(listingId);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }
    if (listing.owner_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to update this listing.' });
    }

     const oldPhotosToDelete = listing.photos
         ? listing.photos.filter(photo => !existingPhotosToKeep.includes(photo))
         : [];

     if (oldPhotosToDelete.length > 0) {
         const uploadDir = path.join(__dirname, '../uploads');
         for (const filename of oldPhotosToDelete) {
             const filePath = path.join(uploadDir, filename);
             try {
                 await fs.access(filePath);
                 await fs.unlink(filePath);
             } catch (fileError) {
                 console.warn(`Could not delete old file ${filePath}:`, fileError.message);
             }
         }
     }

    const updatedPhotos = [...existingPhotosToKeep, ...newPhotoFilenames];

    const updatedListing = await listing.update({
      title: title || listing.title,
      description: description || listing.description,
      price: price ? parseFloat(price) : listing.price,
      rooms: rooms !== undefined ? (rooms === '' ? null : parseInt(rooms, 10)) : listing.rooms,
      area: area !== undefined ? (area === '' ? null : parseFloat(area)) : listing.area,
      location: location || listing.location,
      amenities: amenities || listing.amenities,
      type: type || listing.type,
      photos: updatedPhotos.length > 0 ? updatedPhotos : null,
      latitude: latitude !== undefined ? (latitude === '' ? null : parseFloat(latitude)) : listing.latitude,
      longitude: longitude !== undefined ? (longitude === '' ? null : parseFloat(longitude)) : listing.longitude,
      // status: userRole === 'admin' ? (req.body.status || listing.status) : 'pending', // Admin can change status, others reset to pending on edit.
    });
    // If owner edits, set status to 'pending' for re-approval, unless it's an admin.
    // This logic can be more nuanced based on which fields are changed.
    if (userRole !== 'admin' && listing.status !== 'pending') {
        await updatedListing.update({ status: 'pending' });
    } else if (userRole === 'admin' && req.body.status) {
        await updatedListing.update({status: req.body.status });
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