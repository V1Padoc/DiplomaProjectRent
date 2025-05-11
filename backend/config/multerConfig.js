// backend/config/multerConfig.js

const multer = require('multer');
const path = require('path'); // Node.js built-in module for working with file paths
const fs = require('fs'); // Node.js built-in module for file system operations

// Define the directory where uploaded files will be stored
const uploadDir = path.join(__dirname, '../uploads'); // Create an 'uploads' folder one level up from 'config'

// Create the upload directory if it doesn't exist
// fs.existsSync checks if the directory exists
// fs.mkdirSync creates the directory
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log(`Created uploads directory: ${uploadDir}`);
}

// Configure multer storage
const storage = multer.diskStorage({
  // Destination where files will be saved
  destination: (req, file, cb) => {
    // cb(error, destination_path)
    cb(null, uploadDir); // Files will be saved in the 'uploads' directory
  },
  // Define how files will be named
  filename: (req, file, cb) => {
    // cb(error, filename)
    // We want unique filenames to avoid conflicts.
    // Using a timestamp and the original file extension is a common approach.
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Get the file extension from the original filename
    const fileExtension = path.extname(file.originalname);
    // Combine unique suffix and original extension for the new filename
    cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
    // file.fieldname will be the name of the form field (e.g., 'photos')
  }
});

// Create the multer upload instance
// Configure file filtering (optional but recommended for security)
const upload = multer({
  storage: storage, // Use the configured storage
  // Optional: Limit file size (e.g., 5MB)
  limits: { fileSize: 1024 * 1024 * 5 }, // 5 megabytes
  // Optional: Filter file types (e.g., only allow images)
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/; // Allowed file extensions (regex)
    const mimetype = filetypes.test(file.mimetype); // Test against MIME type
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase()); // Test against file extension

    if (mimetype && extname) {
      // If file type and extension are allowed, accept the file
      return cb(null, true);
    } else {
      // If not allowed, reject the file with an error message
      cb('Error: Images Only (jpeg, jpg, png, gif)!');
    }
  }
});

// Export the configured multer upload instance
// .array('photos', 10) means it expects multiple files from a field named 'photos', with a max of 10 files.
// If you only expect a single file, use .single('photo')
module.exports = upload; // Export the configured multer instance (ready to use as middleware)