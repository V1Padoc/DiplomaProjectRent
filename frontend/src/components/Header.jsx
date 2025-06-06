// frontend/src/components/Header.jsx

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BellIcon,
  ChatBubbleLeftEllipsisIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  HeartIcon as FavHeartIcon,
  HomeModernIcon, // For Create Listing / My Listings
  UserCircleIcon, // Fallback for avatar
  ArrowRightOnRectangleIcon, // Logout
  ChevronDownIcon, // Dropdown indicator
  MagnifyingGlassIcon, // For Listings
  MapIcon // For Map View
} from '@heroicons/react/24/outline';
import { Cog6ToothIcon } from '@heroicons/react/24/solid'; // Example for Admin

const NotificationBadge = ({ count }) => {
  if (!count || count === 0) return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
      {count > 9 ? '9+' : count}
    </span>
  );
};

// Helper to get avatar URL, similar to ProfilePage
const getAvatarUrl = (profileImageUrl, nameOrEmail, size = 32) => {
    if (profileImageUrl) {
        const filename = profileImageUrl.split('/').pop();
        return `http://localhost:5000/uploads/profiles/${filename}`;
    }
    const initials = nameOrEmail ? nameOrEmail.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=${size}&font-size=0.45&bold=true`;
};


function Header() {
  const { isAuthenticated, user, logout,
          unreadMessagesCount,
          unreadBookingRequestsCount,
          unreadMyBookingsUpdatesCount,
          unreadAdminTasksCount
        } = useAuth();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileDropdownRef]);

  const handleLogout = () => {
    logout();
    setIsProfileDropdownOpen(false); // Close dropdown on logout
    navigate('/'); // Navigate to home on logout
  };
  
  const UserAvatar = () => (
    <img
        src={getAvatarUrl(user?.profile_photo_url, user?.name || user?.email, 36)}
        alt={user?.name || 'User'}
        className="w-9 h-9 rounded-full object-cover border-2 border-slate-200 hover:border-blue-500 transition-colors"
    />
  );


  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16"> {/* Fixed height header */}

          {/* Left Side: Logo and Primary Nav */}
          <div className="flex items-center space-x-8">
            <Link to="/" className="text-2xl font-bold text-slate-800 hover:text-blue-600 transition-colors">
              Rentify
            </Link>
            <nav className="hidden md:flex space-x-5 items-center">
              <Link to="/listings" className="text-slate-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center">
                <MagnifyingGlassIcon className="w-5 h-5 mr-1.5 text-slate-400 group-hover:text-blue-500"/> Listings
              </Link>
              <Link to="/map-listings" className="text-slate-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center">
                <MapIcon className="w-5 h-5 mr-1.5 text-slate-400 group-hover:text-blue-500"/> Map View
              </Link>
            </nav>
          </div>

          {/* Right Side: Actions & Profile */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {isAuthenticated && user ? (
              <>
                {/* Notification Icons Area */}
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Link to="/my-chats" className="relative text-slate-500 hover:text-blue-600 p-2 rounded-full hover:bg-slate-100 transition-colors" title="My Chats">
                    <ChatBubbleLeftEllipsisIcon className="w-6 h-6" />
                    <NotificationBadge count={unreadMessagesCount} />
                  </Link>

                  {user.role === 'owner' && (
                    <Link to="/booking-requests" className="relative text-slate-500 hover:text-blue-600 p-2 rounded-full hover:bg-slate-100 transition-colors" title="Booking Requests">
                      <BellIcon className="w-6 h-6" />
                      <NotificationBadge count={unreadBookingRequestsCount} />
                    </Link>
                  )}
                  {user.role === 'tenant' && (
                     <Link to="/my-bookings" className="relative text-slate-500 hover:text-blue-600 p-2 rounded-full hover:bg-slate-100 transition-colors" title="My Bookings Updates">
                        <CalendarDaysIcon className="w-6 h-6"/>
                        <NotificationBadge count={unreadMyBookingsUpdatesCount} />
                     </Link>
                  )}
                  {user.role === 'admin' && (
                    <Link to="/admin" className="relative text-slate-500 hover:text-blue-600 p-2 rounded-full hover:bg-slate-100 transition-colors" title="Admin Panel">
                      <Cog6ToothIcon className="w-6 h-6" />
                       <NotificationBadge count={unreadAdminTasksCount} />
                    </Link>
                  )}
                </div>

                {/* Profile Dropdown */}
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                    className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    aria-expanded={isProfileDropdownOpen}
                    aria-haspopup="true"
                  >
                    <UserAvatar />
                    <ChevronDownIcon className={`w-4 h-4 ml-1 text-slate-500 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isProfileDropdownOpen && (
                    <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-xl bg-white ring-1 ring-black ring-opacity-5 focus:outline-none py-1">
                      <div className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800 truncate">{user.name || user.email}</p>
                        <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                      </div>
                      <div className="border-t border-slate-200"></div>
                      <Link to="/profile" onClick={() => setIsProfileDropdownOpen(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">
                        My Profile
                      </Link>
                      <Link to="/favorites" onClick={() => setIsProfileDropdownOpen(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">
                        Favorites
                      </Link>
                      {(user.role === 'tenant' || user.role === 'owner') && (
                          <Link to="/my-bookings" onClick={() => setIsProfileDropdownOpen(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">
                            My Bookings
                          </Link>
                      )}
                      {user.role === 'owner' && (
                        <>
                          <Link to="/manage-listings" onClick={() => setIsProfileDropdownOpen(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">
                            My Listings
                          </Link>
                          <Link to="/create-listing" onClick={() => setIsProfileDropdownOpen(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">
                            Create Listing
                          </Link>
                        </>
                      )}
                      <div className="border-t border-slate-200"></div>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                      >
                        <ArrowRightOnRectangleIcon className="w-5 h-5 inline-block mr-2 -mt-0.5"/> Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              // Logged out state
              <div className="hidden md:flex items-center space-x-2">
                 <Link
                  to="/login"
                  className="text-slate-600 hover:text-blue-600 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors shadow-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile Menu Button (Placeholder for future) */}
            <div className="md:hidden flex items-center">
              {/* Hamburger icon can go here if you implement full mobile nav */}
              {!isAuthenticated && (
                 <Link
                  to="/login"
                  className="text-slate-600 hover:text-blue-600 p-2 rounded-md text-sm font-medium transition-colors"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;