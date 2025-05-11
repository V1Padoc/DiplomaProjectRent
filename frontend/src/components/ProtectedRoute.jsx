// frontend/src/components/ProtectedRoute.jsx

import React from 'react';
import { Navigate } from 'react-router-dom'; // Import Navigate for redirection
import { useAuth } from '../context/AuthContext'; // Import the useAuth hook

// ProtectedRoute component definition
// This component acts as a wrapper for routes that require authentication
const ProtectedRoute = ({ children, allowedRoles }) => {
  // Get authentication state and user details from the Auth Context
  const { isAuthenticated, user, loading } = useAuth();

  // If authentication status is still loading, render nothing or a loading indicator
  // This prevents showing unauthorized content briefly while the token is being checked
  if (loading) {
      return <div>Loading authentication...</div>; // Or return null, or a spinner component
  }

  // Check if the user is authenticated
  if (!isAuthenticated) {
    // If not authenticated, redirect them to the login page
    // The 'replace' prop replaces the current history entry
    return <Navigate to="/login" replace />;
  }

  // If the user is authenticated, check if allowedRoles are specified and if the user's role is included
  // If allowedRoles is provided AND the user's role is NOT in the allowedRoles list
  if (allowedRoles && allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    // If the user's role is not allowed for this route, you might redirect to a different page
    // like a 403 Forbidden page, or just the homepage. Let's redirect to homepage for simplicity.
    console.warn(`User with role "${user.role}" attempted to access restricted route. Required roles: ${allowedRoles.join(', ')}`);
    return <Navigate to="/" replace />; // Redirect to homepage
  }


  // If authenticated and role is allowed (or no specific roles are required), render the children (the protected route's component)
  return children;
};

export default ProtectedRoute;