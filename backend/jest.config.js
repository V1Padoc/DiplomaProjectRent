// backend/jest.config.js
module.exports = {
  testEnvironment: 'node', // Important for backend tests
  verbose: true,
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // Coverage reporting
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8', // or 'babel'
  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/coverage/**',
    '!jest.config.js',
    '!server.js', // Often exclude main server file from unit test coverage if testing controllers/routes directly
    '!**/migrations/**',
    '!**/seeders/**',
    '!config/config.json' // Exclude sequelize-cli config
  ],
  // Setup file to run before each test file
  // setupFilesAfterEnv: ['./jest.setup.js'], // Optional: if you need global setup
};