// frontend/src/context/AuthContext.js

import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios'; // We'll use axios to fetch user data with the token

// Create the Auth Context
const AuthContext = createContext();

// Create a custom hook to use the Auth Context easily
export const useAuth = () => {
  return useContext(AuthContext);
};

// Create the Auth Provider component
export const AuthProvider = ({ children }) => {
  // State to hold the authentication token
  const [token, setToken] = useState(null);
  // State to hold the authenticated user's data
  const [user, setUser] = useState(null);
  // State to indicate if the authentication status is still being loaded (e.g., checking local storage)
  const [loading, setLoading] = useState(true);

  // useEffect hook to run code after the component mounts
  useEffect(() => {
    // Function to load token and user data when the app starts
    const loadUser = async () => {
      // 1. Check if a token exists in localStorage
      const storedToken = localStorage.getItem('token');

      if (storedToken) {
        setToken(storedToken); // Set the token state

        // 2. If a token exists, try to fetch user data from the backend
        try {
          // Set the Authorization header for the request
          const config = {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          };
          // Call the backend endpoint to get user details
          const res = await axios.get('http://localhost:5000/api/auth/user', config);

          setUser(res.data); // Set the user state with data from the backend
          console.log('User loaded from token:', res.data); // Log for debugging

        } catch (err) {
          // If token is invalid or expired, clear local storage and state
          console.error('Error loading user with token:', err.response?.data?.message || err.message);
          localStorage.removeItem('token'); // Remove invalid token
          setToken(null);
          setUser(null);
          // Optionally redirect to login page here if token was invalid
          // navigate('/login'); // You would need access to navigate here, often handled higher up or via prop
        }
      }
      // Set loading to false once the check is complete (regardless of whether a token was found)
      setLoading(false);
    };

    // Call the loadUser function when the component mounts
    loadUser();
  }, []); // The empty dependency array [] means this effect runs only once after the initial render

  const refreshUser = async () => {
    if (token) {
      try {
        const config = { headers: { 'Authorization': `Bearer ${token}` } };
        const res = await axios.get('http://localhost:5000/api/auth/user', config);
        setUser(res.data);
      } catch (err) {
        console.error('Error refreshing user data:', err);
        // Optionally handle token invalidation if refresh fails
      }
    }
  };
  // Function to handle user login (called from LoginPage)
  const login = async (newToken) => {
    setToken(newToken); // Set the token state
    localStorage.setItem('token', newToken); // Store the new token in localStorage

    // Fetch user data immediately after login
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${newToken}`
        }
      };
      const res = await axios.get('http://localhost:5000/api/auth/user', config);
      setUser(res.data); // Set user state
      console.log('User data fetched after login:', res.data); // Log for debugging

    } catch (err) {
      console.error('Error fetching user data after login:', err.response?.data?.message || err.message);
      // If fetching user data fails even after receiving a token, something is wrong
      // Consider logging out the user or showing an error
      logout(); // Log out if user data cannot be fetched
    }
  };

  // Function to handle user logout
  const logout = () => {
    setToken(null); // Clear token state
    setUser(null); // Clear user state
    localStorage.removeItem('token'); // Remove token from localStorage
    console.log('User logged out.'); // Log for debugging
    // Optionally redirect to homepage or login page after logout
    // navigate('/'); // You would need access to navigate here
  };

  // The context value that will be provided to descendant components
  const authContextValue = {
    token,       // The JWT token
    user,        // The authenticated user's data
    loading,     // True while checking for initial token
    isAuthenticated: token !== null && user !== null,
    refreshUser,
    login,       // Function to call upon successful login
    logout       // Function to call to log the user out
  };

  // Provide the context value to the children components
  // We only render children when loading is false, ensuring user state is ready
  return (
    <AuthContext.Provider value={authContextValue}>
      {/* Optionally show a loading spinner here while loading === true */}
      {!loading ? children : <div>Loading...</div>}
    </AuthContext.Provider>
  );
};