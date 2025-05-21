// backend/controllers/listingController.js

const { Op } = require('sequelize'); // Import Op for operators like equals, like, etc. (will use later for search/filter)
const Listing = require('../models/Listing'); // Import the Listing model
const User = require('../models/User'); // Import User model if you need to include owner info
const Review = require('../models/Review'); // Import the Review model// Import the Review model
const path = require('path');
const fs = require('fs').promises; // Use promises version of fs for async operations
// Controller function to get all listings

exports.getListings = async (req, res) => {
  try {
    const {
      page = 1, // Default to page 1
      limit = 10, // Default to 10 listings per page
      sortBy = 'created_at', // Default sort by creation date
      sortOrder = 'DESC', // Default sort order (newest first)
      type, // 'rent' or 'sale'
      priceMin,
      priceMax,
      roomsMin, // Minimum number of rooms
      location, // Search term for location
      search, // General keyword search for title/description
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    let whereClause = {
      status: 'active', // Always filter by active status for public listings
    };

    // --- Build dynamic where clause ---
    if (type) {
      whereClause.type = type;
    }
    if (priceMin && priceMax) {
      whereClause.price = { [Op.between]: [parseFloat(priceMin), parseFloat(priceMax)] };
    } else if (priceMin) {
      whereClause.price = { [Op.gte]: parseFloat(priceMin) };
    } else if (priceMax) {
      whereClause.price = { [Op.lte]: parseFloat(priceMax) };
    }

    if (roomsMin) {
      whereClause.rooms = { [Op.gte]: parseInt(roomsMin, 10) };
    }

    if (location) {
      whereClause.location = { [Op.iLike]: `%${location}%` }; // Case-insensitive search for location
    }

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        // You could extend search to other fields like amenities if needed
      ];
    }
    // --- End of building where clause ---

    // --- Build order clause ---
    const validSortFields = ['created_at', 'price', 'rooms', 'area']; // Add other valid fields
    const order = [];
    if (validSortFields.includes(sortBy)) {
      order.push([sortBy, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']);
    } else {
      order.push(['created_at', 'DESC']); // Default sort if sortBy is invalid
    }
    // --- End of building order clause ---

    // Fetch listings with pagination, filtering, and sorting
    const { count, rows: listings } = await Listing.findAndCountAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'Owner',
        attributes: ['name', 'email'],
      }],
      order: order,
      limit: parsedLimit,
      offset: offset,
    });

    res.status(200).json({
      totalItems: count,
      totalPages: Math.ceil(count / parsedLimit),
      currentPage: parseInt(page, 10),
      listings, // The array of listings for the current page
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
    const listing = await Listing.findByPk(listingId, {
      where: {
         status: 'active'
      },
      include: [
        {
          model: User,
          as: 'Owner',
          attributes: ['id', 'name', 'email']
        }
      ]
    });
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found or is not active.' });
    }
    // --- Increment views_count (Placeholder for Analytics) ---
    // This is a simplified way. In a real app, you might want to avoid double counting
    // for the same user session, or use a dedicated analytics service/table.
    // For now, let's just increment if the Analytics model exists.
    try {
        const Analytics = require('../models/Analytics'); // Make sure Analytics model is imported or required here
        const [analyticsEntry, created] = await Analytics.findOrCreate({
            where: { listing_id: listingId },
            defaults: { listing_id: listingId, views_count: 1 }
        });
        if (!created) {
            await analyticsEntry.increment('views_count');
        }
        console.log(`Views for listing ${listingId} updated.`);
    } catch (analyticsError) {
        console.error('Error updating views count:', analyticsError);
        // Don't let analytics error break the main listing fetch
    }
    // --- End of Increment views_count ---
    res.status(200).json(listing);
  } catch (error) {
    console.error('Error fetching listing by ID:', error);
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
        attributes: ['id', 'name', 'email']
      }]
    });
    res.status(200).json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Server error while fetching reviews.' });
  }
};


// Controller function to create a new review for a listing
// This requires authentication, so it will run after authMiddleware
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
            attributes: ['id', 'name', 'email']
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
  // Get the authenticated user's ID from req.user (set by authMiddleware)
  const ownerId = req.user.id;

  try {
    // Find all listings where the owner_id matches the authenticated user's ID
    const listings = await Listing.findAll({
      where: {
        owner_id: ownerId // Filter listings by the owner's ID
      },
      // Order listings, e.g., by creation date (newest first)
      order: [['created_at', 'DESC']],
       // You might choose to include associated data here like reviews count, etc.
       // include: [...]
    });

    // Send the fetched listings back as a JSON response
    res.status(200).json(listings);

  } catch (error) {
    // If any error occurs during the database query
    console.error('Error fetching owner listings:', error);
    // Send a 500 Internal Server Error response
    res.status(500).json({ message: 'Server error while fetching owner listings.' });
  }
};


exports.deleteListing = async (req, res) => {
  // Get the listing ID from the request parameters
  const listingId = req.params.id;
  // Get the authenticated user's ID from req.user
  const userId = req.user.id;

  try {
    // Find the listing by its ID and verify it belongs to the authenticated user
    const listing = await Listing.findOne({
      where: {
        id: listingId,
        owner_id: userId // Ensure the listing belongs to the authenticated user
      }
    });

    // If listing not found or doesn't belong to the user
    if (!listing) {
      // 404 Not Found: Listing with this ID for this owner does not exist
      // or 403 Forbidden: The user is authenticated but does not own this listing
      // Sending 404 is often safer as it doesn't reveal if the listing exists but belongs to someone else.
      return res.status(404).json({ message: 'Listing not found or you do not have permission to delete it.' });
    }

    // --- Optional: Delete associated image files from the server ---
    if (listing.photos && listing.photos.length > 0) {
        const uploadDir = path.join(__dirname, '../uploads'); // Path to your uploads folder
        for (const filename of listing.photos) {
            const filePath = path.join(uploadDir, filename);
            try {
                await fs.unlink(filePath); // Delete the file asynchronously
                console.log(`Deleted file: ${filePath}`);
            } catch (fileError) {
                // Log file deletion errors but don't stop the listing deletion process
                console.error(`Error deleting file ${filePath}:`, fileError);
            }
        }
    }
    // --- End of Optional File Deletion ---


    // Delete the listing from the database
    await listing.destroy(); // Sequelize instance method to delete the record

    // Send a success response
    res.status(200).json({ message: 'Listing deleted successfully.' });

  } catch (error) {
    // If any error occurs during the process (e.g., database error)
    console.error('Error deleting listing:', error);
    res.status(500).json({ message: 'Server error during listing deletion.' });
  }
};

exports.getListingForEdit = async (req, res) => {
  // Get the listing ID from the request parameters
  const listingId = req.params.id;
  // Get the authenticated user's ID and role from req.user
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // Find the listing by its ID
    const listing = await Listing.findByPk(listingId, {
      // You might still want to include the owner's basic info
      include: [{
        model: User,
        as: 'Owner',
        attributes: ['id', 'name', 'email']
      }]
       // We do NOT filter by status here, as owner needs to edit pending/rejected listings
    });

    // If listing not found
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    // --- Authorization Check: Verify if the authenticated user is the owner or an admin ---
    if (listing.owner_id !== userId && userRole !== 'admin') {
      // 403 Forbidden: The user is authenticated but does not own this listing and is not an admin
      return res.status(403).json({ message: 'You do not have permission to edit this listing.' });
    }
    // --- End of Authorization Check ---


    // If listing found and user is authorized, send the listing data back
    res.status(200).json(listing);

  } catch (error) {
    console.error('Error fetching listing for edit:', error);
    res.status(500).json({ message: 'Server error while fetching listing for edit.' });
  }
};

exports.updateListing = async (req, res) => {
  // Get the listing ID from the request parameters
  const listingId = req.params.id;
  // Get the authenticated user's ID and role from req.user
  const userId = req.user.id;
  const userRole = req.user.role;

  // req.body contains the text/number fields from the form
  // Make sure to parse numerical values
  const { title, description, price, rooms, area, location, amenities, type }
      = req.body; // Note: latitude and longitude also come from req.body

  // req.files contains an array of file objects provided by multer for *new* uploads
  const newPhotoFilenames = req.files ? req.files.map(file => file.filename) : [];

  // --- Handling existing photos ---
  // The frontend needs to tell the backend which existing photos to keep.
  // A common way is to send an array of filenames to keep in the request body.
  // We'll assume the frontend sends a 'existingPhotos' array in req.body.
  // If 'existingPhotos' is not provided, we assume all old photos should be removed except new ones.
  const existingPhotosToKeep = Array.isArray(req.body.existingPhotos) ? req.body.existingPhotos : [];
  // Note: req.body might parse 'existingPhotos' as a single string if only one is sent without array notation,
  // or as an array if multiple are sent. Array.isArray() handles this.

  // --- End of Handling existing photos ---


  try {
    // Find the listing by its ID
    const listing = await Listing.findByPk(listingId);

    // If listing not found
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    // --- Authorization Check: Verify if the authenticated user is the owner or an admin ---
    if (listing.owner_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to update this listing.' });
    }
    // --- End of Authorization Check ---


    // --- Optional: Delete old photos that are NOT in the 'existingPhotosToKeep' list ---
     const oldPhotosToDelete = listing.photos
         ? listing.photos.filter(photo => !existingPhotosToKeep.includes(photo))
         : []; // Find photos currently in DB but not in the 'keep' list

     if (oldPhotosToDelete.length > 0) {
         const uploadDir = path.join(__dirname, '../uploads'); // Path to your uploads folder
         for (const filename of oldPhotosToDelete) {
             const filePath = path.join(uploadDir, filename);
             try {
                 // Use fs.access to check if the file exists before trying to delete
                 await fs.access(filePath); // Check if file is accessible (exists)
                 await fs.unlink(filePath); // Delete the file asynchronously
                 console.log(`Deleted old file: ${filePath}`);
             } catch (fileError) {
                 // If access or unlink fails (e.g., file didn't exist or permission issue)
                 console.warn(`Could not delete old file ${filePath}:`, fileError.message);
                 // Continue with the process even if a file couldn't be deleted
             }
         }
     }
    // --- End of Optional Old File Deletion ---


    // Combine photos to keep with newly uploaded photo filenames
    const updatedPhotos = [...existingPhotosToKeep, ...newPhotoFilenames];

    // Update the listing attributes
    const updatedListing = await listing.update({
      title: title || listing.title, // Use new value or keep old if not provided
      description: description || listing.description,
      price: price ? parseFloat(price) : listing.price,
      rooms: rooms !== undefined ? parseInt(rooms, 10) : listing.rooms, // Handle 0 rooms correctly
      area: area !== undefined ? parseFloat(area) : listing.area, // Handle 0 area correctly
      location: location || listing.location,
      amenities: amenities || listing.amenities,
      type: type || listing.type,
      // Note: Status is typically updated by admin, not the owner directly via this form
      // status: 'pending', // You might set status back to pending if significant changes require re-approval
      photos: updatedPhotos.length > 0 ? updatedPhotos : null, // Save the updated array of filenames (or null)
      // --- Update latitude and longitude ---
      latitude: req.body.latitude !== undefined ? parseFloat(req.body.latitude) : listing.latitude,
      longitude: req.body.longitude !== undefined ? parseFloat(req.body.longitude) : listing.longitude,
      // --- End of latitude and longitude update ---
      // Sequelize automatically updates 'updated_at' when using .update()
    });

    // If update is successful, send a success response
    res.status(200).json({
      message: 'Listing updated successfully!',
      listing: { // Send back some details of the updated listing
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