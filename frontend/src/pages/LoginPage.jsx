// frontend/src/pages/LoginPage.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import the useAuth hook

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth(); // Use the useAuth hook to get the login function and isAuthenticated state

  // Optional: If the user is already authenticated, redirect them away from the login page
  // This prevents logged-in users from seeing the login form
  useEffect(() => {
      if (isAuthenticated) {
          navigate('/'); // Redirect to homepage if already authenticated
      }
  }, [isAuthenticated, navigate]); // Run this effect when isAuthenticated or navigate changes


  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');
    setSuccess('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email,
        password
      });

      const token = response.data.token;

      // *** Instead of setting localStorage directly and navigating ***
      // *** Call the login function from the Auth Context ***
      login(token); // This will set the token in state, localStorage, and fetch user data

      // The login function in AuthContext handles the user state and fetching user data.
      // The useEffect in AuthProvider will handle loading the user on app mount.
      // We can navigate *after* calling login, but the useEffect above might also handle initial redirection.
      // For simplicity, let's rely on the AuthProvider to manage the state and redirect.
      // navigate('/'); // You can still keep this here if you want immediate navigation after successful API call

    } catch (err) {
      console.error('Login failed:', err);
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    }
  };

  // If isAuthenticated is true, the useEffect above will redirect, so we don't render the form
   if (isAuthenticated) {
       return null; // Or return a message like "You are already logged in."
   }


  return (
    <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-sm shadow-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Login to Your Account</h1>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
        {/* Success message usually not needed here as we redirect */}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Email
            </label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
              type="submit"
            >
              Login
            </button>
            <Link className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800" to="/register">
              Don't have an account? Register
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;