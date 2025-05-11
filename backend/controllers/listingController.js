// backend/controllers/listingController.js

const { Op } = require('sequelize'); // Import Op for operators like equals, like, etc. (will use later for search/filter)
const Listing = require('../models/Listing'); // Import the Listing model
const User = require('../models/User'); // Import User model if you need to include owner info
const path = require('path');
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


// Keep other listing controller functions below this
// exports.updateListing = async (req, res) => { ... };
// exports.deleteListing = async (req, res) => { ... };