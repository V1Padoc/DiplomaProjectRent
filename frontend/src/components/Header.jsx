// frontend/src/components/Header.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Header() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-gray-800">
          ApartmentApp
        </Link>

        <nav>
          <ul className="flex space-x-4">
            <li>
              <Link to="/" className="text-gray-700 hover:text-gray-900">Home</Link>
            </li>
            <li>
              <Link to="/listings" className="text-gray-700 hover:text-gray-900">Listings</Link>
            </li>
 <li><Link to="/map-listings" className="text-gray-700 hover:text-gray-900">Map View</Link></li>
            {isAuthenticated ? (
              <> 
                  {/* *** NEW: Link to My Chats *** */}
                <li>
                    <Link to="/my-chats" className="text-gray-700 hover:text-gray-900">My Chats</Link>
                </li>
                   {(user?.role === 'tenant' || user?.role === 'owner') && ( // Show if tenant or if owner (owners might book too)
                   <li>
                       <Link to="/my-bookings" className="text-gray-700 hover:text-gray-900">My Bookings</Link>
                   </li>
                )}
                {/* Link for creating a listing - visible only to owners */}
                 {user && user.role === 'owner' && (
                   <li>
                       <Link to="/booking-requests" className="text-gray-700 hover:text-gray-900">Booking Requests</Link>
                   </li>
                )}
                {user && user.role === 'owner' && (
                   <li>
                       <Link to="/create-listing" className="text-blue-600 hover:text-blue-800 font-semibold">Create Listing</Link> {/* Styled link */}
                   </li>
                )}

                {/* Keep existing role-specific links (My Listings, Admin) */}
                {user && user.role === 'owner' && (
                   <li>
                       <Link to="/manage-listings" className="text-gray-700 hover:text-gray-900">My Listings</Link>
                   </li>
                )}
                 {user && user.role === 'admin' && (
                    <li>
                         <Link to="/admin" className="text-gray-700 hover:text-gray-900">Admin Panel</Link>
                    </li>
                 )}
                <li>
                  <Link to="/profile" className="text-gray-700 hover:text-gray-900">Profile</Link>
                </li>
                <li>
                  <button
                    onClick={logout}
                    className="text-gray-700 hover:text-gray-900 focus:outline-none"
                  >
                    Logout ({user?.name || user?.email})
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link to="/login" className="text-gray-700 hover:text-gray-900">Login</Link>
                </li>
                <li>
                  <Link to="/register" className="text-gray-700 hover:text-gray-900">Register</Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Header;