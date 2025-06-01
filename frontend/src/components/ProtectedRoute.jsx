// frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom'; // Import useLocation
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation(); // Get current location

  if (loading) {
      return <div>Loading authentication...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />; // Pass current location
  }

  // Specific handling for /my-bookings to allow owners
  if (location.pathname === '/my-bookings') {
    if (user && (user.role === 'tenant' || user.role === 'owner')) {
      return children; // Allow tenants AND owners
    } else {
      // If not tenant or owner, but authenticated, redirect (e.g., admin)
      console.warn(`User with role "${user?.role}" attempted to access /my-bookings.`);
      return <Navigate to="/" replace />;
    }
  }

  // General role check for other routes
  if (allowedRoles && allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    console.warn(`User with role "${user.role}" attempted to access restricted route at ${location.pathname}. Required roles: ${allowedRoles.join(', ')}`);
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;