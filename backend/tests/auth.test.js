// backend/tests/auth.test.js
const request = require('supertest');
const express = require('express');
const authRoutes = require('../routes/authRoutes'); // Adjust path if needed
const User = require('../models/User'); // Adjust path
const sequelize = require('../config/database'); // Adjust path
const bcrypt = require('bcryptjs');

// Mock the User model for registration to avoid actual DB writes in this unit/integration test
// You can also set up a separate test database. For now, we'll mock.
jest.mock('../models/User'); // This will mock all methods of User

// Setup Express app for testing
const app = express();
app.use(express.json()); // To parse JSON request bodies
app.use('/api/auth', authRoutes); // Mount your auth routes

// Mock environment variable for JWT_SECRET if not loaded by test runner
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret'; 

describe('Auth Routes - Registration', () => {
  // Clear all mocks before each test to ensure a clean state
  beforeEach(() => {
    User.findOne.mockClear();
    User.create.mockClear();
    bcrypt.genSalt = jest.fn(() => Promise.resolve('somesalt')); // Mock genSalt
    bcrypt.hash = jest.fn(() => Promise.resolve('hashedPassword')); // Mock hash
  });

  it('should register a new user successfully', async () => {
    // Mock User.findOne to return null (user doesn't exist)
    User.findOne.mockResolvedValue(null);
    // Mock User.create to simulate successful user creation
    const mockNewUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test',
      last_name: 'User',
      role: 'tenant',
      phone_number: '1234567890',
      // ... other fields that your controller returns
    };
    User.create.mockResolvedValue(mockNewUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test',
        last_name: 'User',
        role: 'tenant',
        phone_number: '1234567890'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message', 'User registered successfully!');
    expect(res.body.user).toMatchObject({
      email: 'test@example.com',
      name: 'Test',
      last_name: 'User',
      role: 'tenant'
    });
    expect(User.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'test@example.com',
      name: 'Test'
      // password will be the mocked hashedPassword
    }));
  });

  it('should return 409 if user already exists', async () => {
    // Mock User.findOne to return an existing user
    User.findOne.mockResolvedValue({ id: 1, email: 'existing@example.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing',
        last_name: 'User',
        role: 'tenant',
        phone_number: '0987654321'
      });

    expect(res.statusCode).toEqual(409);
    expect(res.body).toHaveProperty('message', 'User with this email already exists.');
    expect(User.create).not.toHaveBeenCalled(); // Ensure User.create was not called
  });

  it('should return 422 for invalid registration data (handled by express-validator)', async () => {
    // This test relies on express-validator being applied in your routes
    // and your validator correctly catching the errors.
    const res = await request(app)
      .post('/api/auth/register')
      .send({ // Missing required fields or invalid data
        email: 'not-an-email',
        password: 'short', // Assuming minLength is 6
        // name: '', // Assuming name is required by validator
        // last_name: '',
        // phone_number: '',
        // role: 'invalid_role'
      });
    
    // You need to ensure your validator setup for registration route
    // is active for this test to reflect its behavior accurately.
    // The authValidators.js uses `body().notEmpty()` for name, last_name, phone_number
    // and `isIn()` for role.
    
    expect(res.statusCode).toEqual(422); // express-validator typically returns 422
    expect(res.body).toHaveProperty('message', 'Validation failed, entered data is incorrect.');
    expect(res.body.errors).toBeInstanceOf(Array);
    // Example check for specific error messages (adjust based on your validator messages)
    const emailError = res.body.errors.find(e => e.email);
    expect(emailError.email).toContain('Must be a valid email address.');
    const passwordError = res.body.errors.find(e => e.password);
    expect(passwordError.password).toContain('Password must be at least 6 characters long.');
  });

});

// Optional: Add a describe block for login if you want to test that too.
// describe('Auth Routes - Login', () => { /* ... */ });

// Optional: Hook to close DB connection after all tests if using a real test DB
// afterAll(async () => {
//   await sequelize.close();
// });