// frontend/src/App.js
import React, { Suspense } from 'react'; // <--- Import Suspense
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
// Remove direct imports of page components that will be lazy-loaded
// import HomePage from './pages/HomePage';
// import ListingsPage from './pages/ListingsPage';
// ... and so on for other pages

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

function AppContent() {
  const location = useLocation();
  const noFooterPaths = ['/map-listings'];
  const showFooter = !noFooterPaths.includes(location.pathname);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        {/* Wrap Routes with Suspense */}
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
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manage-listings"
              element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <ManageListingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-listing"
              element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <CreateListingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manage-listings/edit/:id"
              element={
                <ProtectedRoute allowedRoles={['owner', 'admin']}>
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
      {showFooter && <Footer />}
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;