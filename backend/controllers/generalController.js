
// Controller function for the health check route
exports.healthCheck = (req, res) => {
  // This function will be called when the /api/health route is accessed
  res.status(200).json({ message: 'Backend is healthy!' });
};