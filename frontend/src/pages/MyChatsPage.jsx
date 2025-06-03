// frontend/src/pages/MyChatsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api'; // <--- IMPORT apiClient
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Helper function to format timestamp for conversation list
const formatLastMessageTimestamp = (timestampStr) => {
    // If timestampStr is undefined, null, or an empty string
    if (!timestampStr) {
        // console.warn('formatLastMessageTimestamp: Received falsy timestampStr. This might mean the timestamp field is missing from lastMessage.');
        return 'No time'; // Or use 'No date' if you prefer that for missing timestamps
    }

    const date = new Date(timestampStr);

    // If new Date(timestampStr) results in an "Invalid Date" object
    if (isNaN(date.getTime())) {
        // console.warn('formatLastMessageTimestamp: Could not parse date. Input was:', timestampStr);
        return 'Invalid date format'; // This string will appear if parsing fails
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDateOnly.getTime() === today.getTime()) {
        // Today: show time
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (today.getTime() - messageDateOnly.getTime() === 24 * 60 * 60 * 1000) {
        // Yesterday
        return 'Yesterday';
    } else if (now.getFullYear() === messageDateOnly.getFullYear()) {
        // This year, but not today or yesterday: show Month Day
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); // e.g., Aug 15
    } else {
        // Older than this year: show Month Day, Year
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); // e.g., Aug 15, 2023
    }
};


function MyChatsPage() {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token, user, fetchUnreadMessagesCount } = useAuth();

    const fetchMyChats = useCallback(async () => {
        // While apiClient handles the token, this check provides an early exit if the token is not yet available in context,
        // preventing unnecessary API calls or explicit error states during initial load when no token is present.
        if (!token) {
            setError("Authentication required to view your chats.");
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            // Replaced axios.get with apiClient.get. The Authorization header is now handled by the interceptor.
            const response = await apiClient.get('/chats/my-chats');
            // CRITICAL DEBUG STEP (FOR YOU TO USE):
            // Uncomment the lines below temporarily to inspect the structure of response.data and convo.lastMessage
            // This helps confirm the exact field name for the timestamp (e.g., 'created_at', 'createdAt', 'timestamp', 'sentAt', etc.)
            // console.log("MyChatsPage - Raw conversations data from API:", response.data);
            // if (response.data.length > 0 && response.data[0].lastMessage) {
            //     console.log("MyChatsPage - Example lastMessage object for inspection:", response.data[0].lastMessage);
            // }
            setConversations(response.data);
        } catch (err) {
            console.error("Error fetching my chats:", err);
            setError(err.response?.data?.message || "Failed to load chats.");
        } finally {
            setLoading(false);
        }
    }, [token]); // `token` is still a dependency for this useCallback, as it's used directly for the early exit logic.

    useEffect(() => {
        fetchMyChats();
        // No need to pass token explicitly to fetchUnreadMessagesCount if it uses apiClient internally
        fetchUnreadMessagesCount();
    }, [fetchMyChats, fetchUnreadMessagesCount]);

    useEffect(() => {
        const handleChatUpdate = (event) => {
            // console.log('MyChatsPage received chat-update event:', event.detail);
            fetchMyChats();
        };
        window.addEventListener('chat-update', handleChatUpdate);
        return () => {
            window.removeEventListener('chat-update', handleChatUpdate);
        };
    }, [fetchMyChats]);

    if (loading) {
        return <div className="container mx-auto px-4 py-8 text-center">Loading your chats...</div>;
    }

    if (error) {
        return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {error}</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">My Chats</h1>

            {conversations.length === 0 ? (
                <p className="text-center text-gray-600">You have no active chats.</p>
            ) : (
                <div className="space-y-4 max-w-2xl mx-auto">
                    {conversations.map((convo) => {
                        // Guard against missing lastMessage object to prevent crashes
                        if (!convo.lastMessage) {
                            // This can happen if a conversation has no messages yet.
                            // console.warn("MyChatsPage - Conversation has no lastMessage object:", convo);
                            return (
                                <Link
                                    to={`/listings/${convo.listingId}/chat${convo.isCurrentUserListingOwner ? `?with=${convo.otherParticipant.id}` : ''}`}
                                    key={`${convo.listingId}-${convo.otherParticipant.id}-no-msg`}
                                    className="block p-4 bg-white rounded-sm shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <h2 className="text-lg font-semibold text-blue-600">
                                            Chat for: {convo.listingTitle}
                                        </h2>
                                        <span className="text-xs text-gray-500">No messages</span>
                                    </div>
                                    <p className="text-sm text-gray-700 mb-2">
                                        With: <span className="font-medium">{convo.otherParticipant.name}</span>
                                    </p>
                                    <p className="text-sm text-gray-600 truncate italic">
                                        Start the conversation!
                                    </p>
                                </Link>
                            );
                        }

                        // --- MODIFIED PART: Directly use convo.lastMessage.timestamp ---
                        // The backend now ensures `convo.lastMessage.timestamp` is populated
                        // with `message.created_at`.
                        const timestampValueFromMessage = convo.lastMessage.timestamp;

                        const formattedTimestamp = formatLastMessageTimestamp(timestampValueFromMessage);

                        return (
                            <Link
                                to={
                                    `/listings/${convo.listingId}/chat` +
                                    (convo.isCurrentUserListingOwner ? `?with=${convo.otherParticipant.id}` : '')
                                }
                                key={`${convo.listingId}-${convo.otherParticipant.id}`}
                                className={`block p-4 bg-white rounded-sm shadow-sm hover:shadow-md transition-shadow ${
                                    convo.unreadCountForCurrentUser > 0 ? 'border-l-4 border-red-500' : ''
                                }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center">
                                        <h2 className="text-lg font-semibold text-blue-600">
                                            Chat for: {convo.listingTitle}
                                        </h2>
                                        {convo.unreadCountForCurrentUser > 0 && (
                                            <span className="ml-2 bg-red-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                                                {convo.unreadCountForCurrentUser > 9 ? '9+' : convo.unreadCountForCurrentUser}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {formattedTimestamp}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700 mb-2">
                                    With: <span className="font-medium">{convo.otherParticipant.name}</span>
                                </p>
                                <p className={`text-sm text-gray-600 truncate ${
                                    convo.unreadCountForCurrentUser > 0 && convo.lastMessage.senderId !== user?.id ? 'font-bold' : ''
                                }`}>
                                    {convo.lastMessage.senderId === user?.id ? "You: " : `${convo.otherParticipant.name.split(' ')[0]}: `}
                                    {convo.lastMessage.content}
                                </p>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default MyChatsPage;