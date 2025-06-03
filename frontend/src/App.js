// frontend/src/App.js

import React, { Suspense } from 'react'; // <--- Import Suspense
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy-load page components
const HomePage = React.lazy(() => import('./pages/HomePage'));
const ListingsPage = React.lazy(() => import('./pages/ListingsPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const ManageListingsPage = React.lazy(() => import('./pages/ManageListingsPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const CreateListingPage = React.lazy(() => import('./pages/CreateListingPage'));
const ListingDetailPage = React.lazy(() => import('./pages/ListingDetail'));
const EditListingPage = React.lazy(() => import('./pages/EditListingPage'));
const ChatPage = React.lazy(() => import('./pages/ChatPage'));
const MyChatsPage = React.lazy(() => import('./pages/MyChatsPage'));
const BookingRequestsPage = React.lazy(() => import('./pages/BookingRequestsPage'));
const MyBookingsPage = React.lazy(() => import('./pages/MyBookingsPage'));
const PublicProfilePage = React.lazy(() => import('./pages/PublicProfilePage'));
const MapListingsPage = React.lazy(() => import('./pages/MapListingsPage'));
const FavoritesPage = React.lazy(() => import('./pages/FavoritesPage'));


// Simple loading fallback component
const LoadingFallback = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="text-xl text-gray-700">Loading page...</div>
  </div>
);

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
        {/* Wrap Routes with Suspense for lazy loading */}
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route path="/listings" element={<ListingsPage />} />
            <Route path="/map-listings" element={<MapListingsPage />} />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/profiles/:userId" element={<PublicProfilePage />} />

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

            <Route
              path="/favorites"
              element={
                <ProtectedRoute>
                  <FavoritesPage />
                </ProtectedRoute>
              }
            />

          </Routes>
        </Suspense>
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