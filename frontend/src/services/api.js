// frontend/src/services/api.js
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // We can't use hooks directly here

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_URL,
});

// Function to set up interceptors. This needs access to the logout function.
// We'll pass the logout function from AuthContext when initializing.
export const setupInterceptors = (logoutCallback) => {
  apiClient.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token'); // Get token directly from localStorage
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  apiClient.interceptors.response.use(
    (response) => {
      // Any status code that lie within the range of 2xx cause this function to trigger
      return response;
    },
    (error) => {
      // Any status codes that falls outside the range of 2xx cause this function to trigger
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (error.response.status === 401) {
          // Handle Unauthorized error (e.g., token expired or invalid)
          console.error("API request unauthorized (401). Logging out.", error.response.config.url);
          if (logoutCallback) {
            logoutCallback();
          }
          // Optionally, redirect to login page here or let AuthContext handle it
          // window.location.href = '/login'; // Could cause issues if logout already redirects
        }
        // You can add more global error handling here for other status codes if needed
        // e.g., for 403 Forbidden, 500 Internal Server Error, etc.
      } else if (error.request) {
        // The request was made but no response was received
        console.error('API request error: No response received.', error.request);
        // This could be a network error, CORS issue (if not configured properly), or server down
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('API request setup error:', error.message);
      }
      return Promise.reject(error); // Important to reject the promise so individual .catch() blocks can still work
    }
  );
};

export default apiClient;