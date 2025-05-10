// backend/routes/generalRoutes.js

const express = require('express');
const router = express.Router();
const generalController = require('../controllers/generalController'); // Import the controller

// Define the GET route for /health relative to where the router is mounted
// Since this router is mounted at /api in server.js, this will handle GET /api/health
router.get('/health', generalController.healthCheck); // <-- Change this line

module.exports = router; // Export the router to be used in server.js