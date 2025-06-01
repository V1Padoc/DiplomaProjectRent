// frontend/src/App.js

import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom'; // <--- Import useLocation
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ListingsPage from './pages/ListingsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import ManageListingsPage from './pages/ManageListingsPage';
import AdminPage from './pages/AdminPage';
import CreateListingPage from './pages/CreateListingPage';
import ListingDetailPage from './pages/ListingDetail';
import EditListingPage from './pages/EditListingPage';
import ChatPage from './pages/ChatPage';
import MyChatsPage from './pages/MyChatsPage';
import BookingRequestsPage from './pages/BookingRequestsPage';
import ProtectedRoute from './components/ProtectedRoute';
import MyBookingsPage from './pages/MyBookingsPage';
import PublicProfilePage from './pages/PublicProfilePage';
import MapListingsPage from './pages/MapListingsPage';
import FavoritesPage from './pages/FavoritesPage';


// Create a wrapper component to use the useLocation hook
function AppContent() {
  const location = useLocation(); // Get the current location object

  // Define an array of paths where the footer should NOT be displayed
  const noFooterPaths = ['/map-listings']; // Add '/map-listings' here

  // Check if the current path is in the noFooterPaths array
  const showFooter = !noFooterPaths.includes(location.pathname);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />
          <Route path="/listings" element={<ListingsPage />} />
          <Route path="/map-listings" element={<MapListingsPage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Add other public routes here */}

          {/* Protected Routes */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute> {/* Requires authentication */}
                <ProfilePage />
              </ProtectedRoute>
            }
          />

           <Route
             path="/manage-listings"
             element={
               <ProtectedRoute allowedRoles={['owner']}> {/* Protected for owners */}
                 <ManageListingsPage />
               </ProtectedRoute>
             }
           />

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}> {/* Protected for admins */}
                  <AdminPage />
                </ProtectedRoute>
              }
            />

           <Route
             path="/create-listing"
             element={
               <ProtectedRoute allowedRoles={['owner']}> {/* Protected for owners */}
                 <CreateListingPage />
               </ProtectedRoute>
             }
           />

           <Route
             path="/manage-listings/edit/:id"
             element={
               <ProtectedRoute allowedRoles={['owner', 'admin']}> {/* Protected for owners/admins */}
                 <EditListingPage />
               </ProtectedRoute>
             }
           />

           <Route
             path="/listings/:listingId/chat"
             element={
               <ProtectedRoute>
                 <ChatPage />
               </ProtectedRoute>
             }
           />
           <Route
            path="/booking-requests"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <BookingRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-chats"
            element={
              <ProtectedRoute>
                <MyChatsPage />
              </ProtectedRoute>
            }
          />

         <Route
            path="/my-bookings"
            element={
              <ProtectedRoute allowedRoles={['tenant', 'owner']}>
                <MyBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/profiles/:userId" element={<PublicProfilePage />} />

        <Route
            path="/favorites"
           element={
              <ProtectedRoute>
                <FavoritesPage />
              </ProtectedRoute>
            }
          />

        </Routes>

      </main>
      {/* Conditionally render the Footer based on the current path */}
      {showFooter && <Footer />}
    </div>
  );
}

// App component now just renders the AppContent wrapper
function App() {
  return <AppContent />;
}

export default App;