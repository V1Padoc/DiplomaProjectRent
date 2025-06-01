// frontend/src/components/Header.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BellIcon, ChatBubbleLeftEllipsisIcon, CalendarDaysIcon, UserGroupIcon, HeartIcon as FavHeartIcon } from '@heroicons/react/24/outline';

const NotificationBadge = ({ count }) => {
  if (count === 0) return null;
  return (
    // MODIFIED: Changed sizing and text color for the badge
    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
      {count > 9 ? '9+' : count}
    </span>
  );
};

function Header() {
  const { isAuthenticated, user, logout, 
          unreadMessagesCount, 
          unreadBookingRequestsCount, // For owner's booking requests
          unreadMyBookingsUpdatesCount, // For tenant's booking updates
          unreadAdminTasksCount         // For admin tasks
        } = useAuth();

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
                <li className="relative">
                    <Link to="/my-chats" className="text-gray-700 hover:text-gray-900 flex items-center">
                        <ChatBubbleLeftEllipsisIcon className="w-5 h-5 mr-1"/> Chats
                        <NotificationBadge count={unreadMessagesCount} />
                    </Link>
                </li>
                 <li className="relative">
                    <Link to="/favorites" className="text-gray-700 hover:text-gray-900 flex items-center">
                        <FavHeartIcon className="w-5 h-5 mr-1"/> Favorites
                    </Link>
                </li>
                   {(user?.role === 'tenant' || user?.role === 'owner') && (
                   <li className="relative">
                       <Link to="/my-bookings" className="text-gray-700 hover:text-gray-900 flex items-center">
                           <CalendarDaysIcon className="w-5 h-5 mr-1" /> My Bookings
                           {/* Badge for tenant updates */}
                           {user?.role === 'tenant' && <NotificationBadge count={unreadMyBookingsUpdatesCount} />}
                       </Link>
                   </li>
                )}
                {/* Link for creating a listing - visible only to owners */}
                 {user && user.role === 'owner' && (
                   <li className="relative">
                       <Link to="/booking-requests" className="text-gray-700 hover:text-gray-900 flex items-center">
                           <BellIcon className="w-5 h-5 mr-1" /> Booking Requests
                           <NotificationBadge count={unreadBookingRequestsCount} />
                       </Link>
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
                    <li className="relative">
                         <Link to="/admin" className="text-gray-700 hover:text-gray-900 flex items-center">
                            <UserGroupIcon className="w-5 h-5 mr-1"/> Admin
                            <NotificationBadge count={unreadAdminTasksCount} />
                         </Link>
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