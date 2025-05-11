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
    // Fetch all listings from the database where the status is 'active'
    const listings = await Listing.findAll({
      where: {
        status: 'active' // Only retrieve listings that have been approved by admin
      },
      // You might want to order them, e.g., by creation date (newest first)
      order: [['created_at', 'DESC']],
      // Optional: Include the owner's name or email if needed
      include: [{
        model: User,
        as: 'Owner', // Use the alias defined in the model association (if you added one, otherwise remove 'as')
        attributes: ['name', 'email'] // Select only non-sensitive user attributes
        // NOTE: Ensure you have defined the association Listing.belongsTo(User, { as: 'Owner', foreignKey: 'owner_id' });
        // and User.hasMany(Listing, { as: 'Listings', foreignKey: 'owner_id' }); in your models
      }]
    });

    // Send the fetched listings back as a JSON response
    res.status(200).json(listings);

  } catch (error) {
    // If any error occurs during the database query
    console.error('Error fetching listings:', error);
    // Send a 500 Internal Server Error response
    res.status(500).json({ message: 'Server error while fetching listings.' });
  }
};


exports.createListing = async (req, res) => {
  const owner_id = req.user.id;

  // --- Include latitude and longitude in destructuring ---
  const { title, description, price, rooms, area, location, amenities, type, latitude, longitude } = req.body;
  // --- End of destructuring update ---

  const photoFilenames = req.files ? req.files.map(file => file.filename) : [];

  try {
    // Basic validation (add more)
    // You might want to add validation that latitude/longitude are valid numbers if provided
    if (!title || !price || !location || !type) {
      return res.status(400).json({ message: 'Please provide title, price, location, and type.' });
    }

    // Create the new listing
    const newListing = await Listing.create({
      owner_id: owner_id,
      title: title,
      description: description,
      price: parseFloat(price),
      rooms: rooms ? parseInt(rooms, 10) : null,
      area: area ? parseFloat(area) : null,
      location: location,
      // --- Add latitude and longitude here ---
      latitude: latitude ? parseFloat(latitude) : null, // Convert to number, handle optional
      longitude: longitude ? parseFloat(longitude) : null, // Convert to number, handle optional
      // --- End of adding coordinates ---
      amenities: amenities || null,
      type: type,
      status: 'pending',
      photos: photoFilenames.length > 0 ? photoFilenames : null
    });

    // If listing creation is successful
    res.status(201).json({
      message: 'Listing created successfully! Awaiting admin approval.',
      listing: {
        id: newListing.id,
        title: newListing.title,
        owner_id: newListing.owner_id,
        status: newListing.status,
        photos: newListing.photos,
        // Include coordinates in the response
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
  // Get the listing ID from the request parameters (e.g., from /api/listings/123, req.params.id will be '123')
  const listingId = req.params.id;

  try {
    // Find the listing by its primary key (ID)
    // We also include the owner details and potentially other associated data like reviews later
    const listing = await Listing.findByPk(listingId, {
      // Only retrieve listings with status 'active' for public viewing
      where: {
         status: 'active'
         // Note: If an owner needs to view their *pending* listing details,
         // you'll need a separate endpoint or add auth check here
      },
      include: [
        {
          model: User,
          as: 'Owner', // Use the alias defined in the model association
          attributes: ['id', 'name', 'email'] // Select specific owner attributes
        }
        // You will add includes for Reviews, Bookings (if applicable to view), etc. later
        // , {
        //   model: Review,
        //   as: 'Reviews' // Assuming you defined Listing.hasMany(Review, { as: 'Reviews' })
        // }
      ]
    });

    // Check if the listing was found
    if (!listing) {
      // If listing not found (or not active), send a 404 Not Found response
      return res.status(404).json({ message: 'Listing not found or is not active.' });
    }

    // Send the fetched listing data back as a JSON response
    res.status(200).json(listing);

  } catch (error) {
    // If any error occurs (e.g., invalid ID format, database error)
    console.error('Error fetching listing by ID:', error);
    // Send a 500 Internal Server Error response
    res.status(500).json({ message: 'Server error while fetching listing.' });
  }
};

exports.getReviewsByListingId = async (req, res) => {
  const listingId = req.params.listingId; // Get the listing ID from the route parameters

  try {
    // Find all reviews associated with this listing ID
    const reviews = await Review.findAll({
      where: { listing_id: listingId },
      // Order reviews, e.g., by creation date (newest first)
      order: [['created_at', 'DESC']],
      // Include the user who wrote the review (optional but good for display)
      include: [{
        model: User,
        as: 'User', // Assuming you defined Review.belongsTo(User, { as: 'User' })
        attributes: ['id', 'name', 'email'] // Select non-sensitive user attributes
        // NOTE: Ensure you have defined the association Review.belongsTo(User, { as: 'User', foreignKey: 'user_id' });
        // and User.hasMany(Review, { as: 'Reviews', foreignKey: 'user_id' }); in your models
      }]
    });

    // Send the fetched reviews back as a JSON response
    res.status(200).json(reviews);

  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Server error while fetching reviews.' });
  }
};


// Controller function to create a new review for a listing
// This requires authentication, so it will run after authMiddleware
exports.createReview = async (req, res) => {
  const listingId = req.params.listingId; // Get the listing ID from the route parameters
  const userId = req.user.id;           // Get the user ID from the authenticated user (from authMiddleware)

  // Get rating and comment from the request body
  const { rating, comment } = req.body;

  try {
    // Basic validation: Check if required fields are present and valid
    if (rating === undefined || rating === null || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Please provide a valid rating between 1 and 5.' });
    }
    // Comment is optional, but validate rating presence

    // Optional: Check if the user has already reviewed this listing
    // Depending on your rules, you might only allow one review per user per listing
    // const existingReview = await Review.findOne({ where: { listing_id: listingId, user_id: userId } });
    // if (existingReview) {
    //     return res.status(409).json({ message: 'You have already reviewed this listing.' });
    // }


    // Create the new review in the database
    const newReview = await Review.create({
      listing_id: listingId,
      user_id: userId,
      rating: parseInt(rating, 10), // Ensure rating is stored as an integer
      comment: comment || null       // Handle optional comment
    });

    // Fetch the created review with user details to send back to frontend
    const reviewWithUser = await Review.findByPk(newReview.id, {
        include: [{
            model: User,
            as: 'User',
            attributes: ['id', 'name', 'email']
        }]
    });


    // If review creation is successful, send a success response
    res.status(201).json({
      message: 'Review added successfully!',
      review: reviewWithUser // Send back the created review data with user info
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
// Keep other listing controller functions below this
// exports.updateListing = async (req, res) => { ... };
// exports.deleteListing = async (req, res) => { ... };