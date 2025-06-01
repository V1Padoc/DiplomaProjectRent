// frontend/src/context/AuthContext.js

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client'; // Import socket.io-client

// API URL base
const API_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

// Create the Auth Context
const AuthContext = createContext();

// Create a custom hook to use the Auth Context easily
export const useAuth = () => {
  return useContext(AuthContext);
};

// Helper function to safely parse user from localStorage
const getInitialUser = () => {
  const storedUserString = localStorage.getItem('user');
  if (storedUserString && storedUserString !== 'undefined' && storedUserString !== 'null') {
    try {
      const parsedUser = JSON.parse(storedUserString);
      // Basic validation: ensure it's an object, not null, and maybe has an id
      if (parsedUser && typeof parsedUser === 'object' && parsedUser.id) {
        return parsedUser;
      }
      // If parsing is successful but data is not what we expect, treat as invalid
      localStorage.removeItem('user');
      return null;
    } catch (error) {
      console.error("Error parsing user from localStorage:", error);
      localStorage.removeItem('user'); // Clear corrupted item
      return null;
    }
  }
  // If "user" item is "undefined" or "null" string, remove it.
  if (storedUserString === 'undefined' || storedUserString === 'null') {
    localStorage.removeItem('user');
  }
  return null;
};


// Create the Auth Provider component
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(getInitialUser()); // Use the safe getter
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null); // Socket instance

  // For Favorites
  const [favorites, setFavorites] = useState([]);

  // For Unread Notifications
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadBookingRequestsCount, setUnreadBookingRequestsCount] = useState(0); // For Owner: new requests
  const [unreadMyBookingsUpdatesCount, setUnreadMyBookingsUpdatesCount] = useState(0); // For Tenant: booking status changes
  const [unreadAdminTasksCount, setUnreadAdminTasksCount] = useState(0); // For Admin: new pending listings

  // logout function, memoized
  const logout = useCallback(() => {
    if (socket) {
        socket.disconnect();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setFavorites([]);
    setUnreadMessagesCount(0);
    setUnreadBookingRequestsCount(0);
    setUnreadMyBookingsUpdatesCount(0);
    setUnreadAdminTasksCount(0);
    setSocket(null);
    console.log('User logged out.');
  }, [socket]); // socket is a dependency for socket.disconnect()

  const fetchUnreadMessagesCount = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam) return;
    try {
      const response = await axios.get(`${API_URL}/chats/my-unread-count`, {
        headers: { Authorization: `Bearer ${currentTokenParam}` },
      });
      setUnreadMessagesCount(response.data.unreadCount);
    } catch (error) {
      console.error('Failed to fetch unread messages count:', error.response?.data?.message || error.message);
    }
  }, []); // Removed token from deps, pass it as param

  const fetchFavoriteIds = useCallback(async (currentTokenParam) => {
    if (currentTokenParam) {
        try {
            const response = await axios.get(`${API_URL}/users/me/favorites/ids`, {
                headers: { Authorization: `Bearer ${currentTokenParam}` },
            });
            setFavorites(response.data.favorite_ids ? response.data.favorite_ids.map(String) : []);
        } catch (error) {
            console.error("Error fetching favorite IDs:", error.response?.data?.message || error.message);
            if (error.response?.status === 401 && currentTokenParam) { // Check currentTokenParam to avoid loop if already logging out
                // logout(); // Consider if auto-logout here is desired, or handled by refreshUser/login
            } else {
                setFavorites([]);
            }
        }
    } else {
        setFavorites([]);
    }
  }, []); // Removed token from deps, pass it as param. `logout` not needed if handled elsewhere

  // Fetch count of unread booking updates for tenants
  const fetchUnreadBookingUpdatesCount = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam || user?.role !== 'tenant') return;
    try {
      const response = await axios.get(`${API_URL}/users/me/unread-booking-updates-count`, { // You'd need to create this endpoint on backend
        headers: { Authorization: `Bearer ${currentTokenParam}` },
      });
      setUnreadMyBookingsUpdatesCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread booking updates count:', error.response?.data?.message || error.message);
    }
  }, [user?.role]); // Add user.role dependency

  // Fetch count of admin tasks (e.g., pending listings)
  const fetchUnreadAdminTasksCount = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam || user?.role !== 'admin') return;
    try {
      // Assuming an endpoint like /api/admin/tasks-count that returns { pendingListingsCount: X }
      const response = await axios.get(`${API_URL}/admin/tasks-count`, { // You'd need to create this endpoint
        headers: { Authorization: `Bearer ${currentTokenParam}` },
      });
      setUnreadAdminTasksCount(response.data.pendingListingsCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread admin tasks count:', error.response?.data?.message || error.message);
    }
  }, [user?.role]); // Add user.role dependency
  
  // Fetch count of new booking requests for owners (placeholder if needed, similar to above)
  const fetchUnreadBookingRequestsCountForOwner = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam || user?.role !== 'owner') return;
    try {
      // Example: Endpoint to get count of 'pending' bookings for owner's listings
      const response = await axios.get(`${API_URL}/bookings/owner/pending-count`, { // You'd need to create this endpoint
        headers: { Authorization: `Bearer ${currentTokenParam}` },
      });
      setUnreadBookingRequestsCount(response.data.pendingCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread booking requests count for owner:', error.response?.data?.message || error.message);
    }
  }, [user?.role]);


  // Effect for initial authentication check and loading user data
  useEffect(() => {
    const attemptAutoLogin = async () => {
      const storedToken = localStorage.getItem('token');
      console.log('Attempting to connect socket...')
      if (storedToken) {
        setToken(storedToken); // Set token state for other hooks/logic
        try {
          const res = await axios.get(`${API_URL}/auth/user`, {
            headers: { 'Authorization': `Bearer ${storedToken}` }
          });
          const userData = res.data;
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData)); // Correctly store user object

          // Fetch other dependent data now that user is confirmed
          fetchUnreadMessagesCount(storedToken);
          fetchFavoriteIds(storedToken);
          // Fetch role-specific counts
          if (userData.role === 'tenant') {
            fetchUnreadBookingUpdatesCount(storedToken);
          }
          if (userData.role === 'admin') {
            fetchUnreadAdminTasksCount(storedToken);
          }
          if (userData.role === 'owner') {
            fetchUnreadBookingRequestsCountForOwner(storedToken);
          }

        } catch (err) {
          console.error('Auto-login failed (token invalid or server error):', err.response?.data?.message || err.message);
          logout(); // Use the logout function to clear all state
        }
      }
      setLoading(false);
    };

    attemptAutoLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logout, fetchUnreadMessagesCount, fetchFavoriteIds, fetchUnreadBookingUpdatesCount, fetchUnreadAdminTasksCount, fetchUnreadBookingRequestsCountForOwner]); // Add stable callbacks

  // Socket connection management
  useEffect(() => {
    if (token && user?.id) {
      const newSocket = io(SOCKET_URL, {
        // auth: { token } // More secure way to pass token if backend supports it
      });
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
       console.log(`Socket connected with ID: ${newSocket.id}. Emitting 'authenticate_socket' with User ID: ${user.id}, Role: ${user.role}`) // Pass user ID and role for backend mapping and admin room joining
        newSocket.emit('authenticate_socket', { userId: user.id, role: user.role });
      });

      newSocket.on('new_message_notification', (data) => {
        console.log('New message notification (AuthContext):', data);
         console.log(`Dispatching 'chat-update' event.`)
        fetchUnreadMessagesCount(token); // Uses current token from state
        window.dispatchEvent(new CustomEvent('chat-update', { detail: data }));
      });

      newSocket.on('messages_read_update', (data) => {
        console.log('Messages read update received (AuthContext):', data);
         console.log(`Dispatching 'chat-update' event for read status.`)
        fetchUnreadMessagesCount(token); // Uses current token from state
        window.dispatchEvent(new CustomEvent('chat-update', { detail: { type: 'read_update', ...data } }));
      });

      // Listener for booking updates (for tenants)
newSocket.on('new_booking_request_owner', (data) => { // This event name is good
          console.log('AuthContext: Received new_booking_request_owner:', data);
          if (user && user.role === 'owner' ) { // Check if user is still an owner
              fetchUnreadBookingRequestsCountForOwner(token);
          }
      });

      // Listener for booking updates (for tenants)
      newSocket.on('booking_status_update_tenant', (data) => { // THIS EVENT NAME IS GOOD and matches backend proposal
        console.log('AuthContext: Received booking_status_update_tenant:', data);
        if (user && user.role === 'tenant' && data.tenantId === user.id) {
          fetchUnreadBookingUpdatesCount(token);
        }
      });

      // Listener for admin tasks (e.g., new pending listing OR change affecting pending count)
      // Consolidate admin notifications for pending counts
    newSocket.on('admin_new_pending_listing', (data) => {
  console.log('AuthContext: Received admin_new_pending_listing:', data);
  if (user && user.role === 'admin') {
    fetchUnreadAdminTasksCount(token);
  }
});
      newSocket.on('admin_pending_count_changed', (data) => {
  console.log('AuthContext: Received admin_pending_count_changed:', data);
  if (user && user.role === 'admin') {
    fetchUnreadAdminTasksCount(token);
  }
});


      return () => {
        newSocket.off('connect');
        newSocket.off('new_message_notification');
        newSocket.off('messages_read_update');
        newSocket.off('booking_update_notification');
        newSocket.off('admin_task_notification');
        newSocket.off('new_booking_request_owner');
        newSocket.close();
        setSocket(null);
        console.log('Socket disconnected and cleaned up.');
      };
    } else if (socket) { // If token or user becomes null (e.g., logout)
      socket.close();
      setSocket(null);
      console.log('Socket disconnected due to logout or user change.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id, user?.role, fetchUnreadMessagesCount, fetchUnreadBookingUpdatesCount, fetchUnreadAdminTasksCount, fetchUnreadBookingRequestsCountForOwner]);


  // *** MODIFIED LOGIN FUNCTION ***
  const login = async (newToken) => { // Only takes newToken
    if (!newToken) {
      console.error("Login called without a token.");
      logout(); // Clear state if no token
      return;
    }
    localStorage.setItem('token', newToken);
    setToken(newToken); // Set token in state first

    try {
      // Fetch user data using the new token
      const res = await axios.get(`${API_URL}/auth/user`, {
        headers: { 'Authorization': `Bearer ${newToken}` }
      });
      const userData = res.data;
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      // Now that user and token are set, fetch other dependent data
      await fetchUnreadMessagesCount(newToken); // Make sure these complete
      await fetchFavoriteIds(newToken);
      // Fetch role-specific counts after login
      if (userData.role === 'tenant') {
        await fetchUnreadBookingUpdatesCount(newToken);
      }
      if (userData.role === 'admin') {
        await fetchUnreadAdminTasksCount(newToken);
      }
      if (userData.role === 'owner') {
        await fetchUnreadBookingRequestsCountForOwner(newToken);
      }
      // Navigation will be handled by LoginPage's useEffect or App router based on isAuthenticated
    } catch (err) {
      console.error('Failed to fetch user data after login:', err.response?.data?.message || err.message);
      logout(); // If fetching user fails, revert to logged-out state
    }
  };


  const refreshUser = async () => {
    if (token) {
      try {
        const config = { headers: { 'Authorization': `Bearer ${token}` } };
        const res = await axios.get(`${API_URL}/auth/user`, config);
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      } catch (err) {
        console.error('Error refreshing user data:', err);
        if (err.response?.status === 401) logout();
      }
    }
  };

  const toggleFavorite = async (listingId) => {
    if (!token) return favorites.includes(String(listingId)); // Should ideally not be called if no token
    const stringListingId = String(listingId);
    const isCurrentlyFavorited = favorites.includes(stringListingId);
    try {
      if (isCurrentlyFavorited) {
        await axios.delete(`${API_URL}/users/me/favorites/${stringListingId}`, { headers: { Authorization: `Bearer ${token}` } });
        setFavorites(prev => prev.filter(id => id !== stringListingId));
        return false;
      } else {
        await axios.post(`${API_URL}/users/me/favorites/${stringListingId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        setFavorites(prev => [...prev, stringListingId]);
        return true;
      }
    } catch (error) {
      console.error("Error toggling favorite:", error.response?.data?.message || error.message);
      if (error.response?.status === 401) logout();
      return isCurrentlyFavorited; // Return original state on error
    }
  };

  const markChatAsRead = useCallback(async (listingId, chatPartnerId) => {
    if (!token || !listingId || !chatPartnerId) return 0;
    try {
      const response = await axios.put(`${API_URL}/chats/mark-as-read`,
        { listingId: String(listingId), chatPartnerId: String(chatPartnerId) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchUnreadMessagesCount(token); // Refresh total count, pass token
      return response.data.count || 0;
    } catch (error) {
      console.error('Failed to mark chat as read:', error.response?.data?.message || error.message);
      if (error.response?.status === 401 && token) logout();
      return 0;
    }
  }, [token, fetchUnreadMessagesCount, logout]);

  // Function for tenant to acknowledge their booking updates (clears the count)
  const acknowledgeBookingUpdates = useCallback(async () => {
    if (!token || user?.role !== 'tenant') return;
    try {
      await axios.put(`${API_URL}/users/me/acknowledge-booking-updates`, {}, { // You'd need to create this endpoint
        headers: { Authorization: `Bearer ${token}` }
      });
      // After acknowledging, refresh the count (should be 0 or less)
      fetchUnreadBookingUpdatesCount(token);
    } catch (error) {
      console.error('Failed to acknowledge booking updates:', error.response?.data?.message || error.message);
      if (error.response?.status === 401) logout();
    }
  }, [token, user?.role, fetchUnreadBookingUpdatesCount, logout]);

  // Function for admin to "refresh" task count (e.g., after viewing pending items)
  // This simply re-fetches. A more complex system might mark specific tasks as "seen".
  const refreshAdminTasksCount = useCallback(async () => {
    if (!token || user?.role !== 'admin') return;
    fetchUnreadAdminTasksCount(token);
  }, [token, user?.role, fetchUnreadAdminTasksCount]);
  
  // Function for owner to "refresh" booking request count
  const refreshBookingRequestsCountForOwner = useCallback(async () => {
    if (!token || user?.role !== 'owner') return;
    fetchUnreadBookingRequestsCountForOwner(token);
  }, [token, user?.role, fetchUnreadBookingRequestsCountForOwner]);


  const authContextValue = {
    token, user, loading, favorites,
    isAuthenticated: !!token && !!user,
    unreadMessagesCount,
    unreadBookingRequestsCount, // For Owner
    unreadMyBookingsUpdatesCount, // For Tenant
    unreadAdminTasksCount, // For Admin
    socket,
    login, logout, refreshUser,
    toggleFavorite, fetchFavoriteIds,
    markChatAsRead,
    fetchUnreadMessagesCount,
    // Expose new functions and setters if needed by components
    acknowledgeBookingUpdates, // For MyBookingsPage (tenant)
    refreshAdminTasksCount, // For AdminPage
    refreshBookingRequestsCountForOwner, // For BookingRequestsPage (owner)
    fetchUnreadBookingUpdatesCount, // Expose if needed
    fetchUnreadAdminTasksCount, // Expose if needed
    fetchUnreadBookingRequestsCountForOwner, // Expose if needed for owner
    setUnreadBookingRequestsCount, // Kept from original, potentially for direct updates if needed
    setUnreadMyBookingsUpdatesCount, // Kept from original
    setUnreadAdminTasksCount, // Kept from original
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {!loading ? children : <div className="text-center py-10">Loading application state...</div>}
    </AuthContext.Provider>
  );
};