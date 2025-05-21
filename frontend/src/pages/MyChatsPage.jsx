// frontend/src/pages/MyChatsPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function MyChatsPage() {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token, user } = useAuth();

    useEffect(() => {
        const fetchMyChats = async () => {
            if (!token) {
                setError("Authentication required.");
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                setError(null);
                const response = await axios.get('http://localhost:5000/api/chats/my-chats', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setConversations(response.data);
            } catch (err) {
                console.error("Error fetching my chats:", err);
                setError(err.response?.data?.message || "Failed to load chats.");
            } finally {
                setLoading(false);
            }
        };

        fetchMyChats();
    }, [token]);

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
                    {conversations.map((convo) => (
                         <Link
                            // *** MODIFIED LINK: Add otherParticipantId as a query param if current user is listing owner ***
                            to={
                                `/listings/${convo.listingId}/chat` +
                                (convo.isCurrentUserListingOwner ? `?with=${convo.otherParticipant.id}` : '')
                            }
                            key={`${convo.listingId}-${convo.otherParticipant.id}`}
                            className="block p-4 bg-white rounded-sm shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div  className="flex justify-between items-center mb-1">
                                <h2 className="text-lg font-semibold text-blue-600">
                                    Chat for: {convo.listingTitle}
                                </h2>
                                <span className="text-xs text-gray-500">
                                    {new Date(convo.lastMessage.timestamp).toLocaleString()}
                                </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">
                                With: <span className="font-medium">{convo.otherParticipant.name}</span>
                            </p>
                            <p className="text-sm text-gray-600 truncate">
                                {convo.lastMessage.senderId === user?.id ? "You: " : ""}
                                {convo.lastMessage.content}
                            </p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export default MyChatsPage;