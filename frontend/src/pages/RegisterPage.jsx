// frontend/src/pages/RegisterPage.jsx

import React, { useState } from 'react';
import axios from 'axios'; // Import axios to make HTTP requests
import { useNavigate } from 'react-router-dom'; // Import useNavigate for redirection

function RegisterPage() {
  // State variables to hold form input values
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(''); // *** ADDED: State for phone number ***
  const [role, setRole] = useState('tenant'); // Default role is 'tenant'
  const [error, setError] = useState(''); // State for displaying registration errors
  const [success, setSuccess] = useState(''); // State for displaying success message

  const navigate = useNavigate(); // Hook for programmatically navigating

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent the default browser form submission

    setError(''); // Clear previous errors
    setSuccess(''); // Clear previous success messages

    try {
      // Send a POST request to the backend registration endpoint
      const response = await axios.post('http://localhost:5000/api/auth/register', {
        email,
        password,
        name,
        phone_number: phoneNumber, // *** ADDED: Include phone number in the request body ***
        role
      });

      // If registration is successful
      setSuccess(response.data.message); // Display success message from backend
      console.log('Registration successful:', response.data);

      // Optional: Automatically redirect to login page after a delay
      setTimeout(() => {
        navigate('/login'); // Redirect to the login page
      }, 2000); // Redirect after 2 seconds

    } catch (err) {
      // If registration fails (backend returns an error status code like 400, 409, 500)
      console.error('Registration failed:', err);
      // Display the error message from the backend response, or a generic message
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-screen bg-gray-50"> {/* Added background and centering */}
      <div className="w-full max-w-md bg-white p-8 rounded-sm shadow-sm"> {/* Added minimalistic card styling */}
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Create an Account</h1> {/* Styled heading */}

        {/* Display success or error messages */}
        {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{success}</div>}
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Email
            </label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" 
              id="email"
              type="email" // Use type="email" for basic browser validation
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)} // Update state on input change
              required // Make field required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" 
              id="password"
              type="password" // Use type="password" for hiding input
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)} // Update state on input change
              required // Make field required
              minLength="6" // Optional: Add minimum length for password
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
              Name
            </label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" 
              id="name"
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)} // Update state on input change
              required // Make field required
            />
          </div>
          <div className="mb-4"> {/* Assuming you add a phone number field here */}
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone_number">
                Phone Number
            </label>
            <input
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700"
                id="phone_number" 
                type="tel" 
                placeholder="Phone Number"
                value={phoneNumber} // *** CHANGED: Use phoneNumber state ***
                onChange={(e) => setPhoneNumber(e.target.value)} // *** CHANGED: Use setPhoneNumber handler ***
                required // *** ADDED: Make required ***
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="role">
              Register as:
            </label>
            <select
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" 
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)} // Update state on select change
              required // Make field required
            >
              <option value="tenant">Tenant / Buyer</option>
              <option value="owner">Owner / Seller</option>
              {/* Admin role will likely be assigned manually or through a separate process */}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline transition duration-150 ease-in-out" 
              type="submit"
            >
              Register
            </button>
            {/* Optional: Link to login page */}
            <a className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800" href="/login">
              Already have an account? Login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RegisterPage;