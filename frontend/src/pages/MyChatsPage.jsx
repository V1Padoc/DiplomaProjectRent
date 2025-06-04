// frontend/src/pages/MyChatsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const formatLastMessageTimestamp = (timestampStr) => {
    if (!timestampStr) return 'No time';
    const date = new Date(timestampStr);
    if (isNaN(date.getTime())) return 'Invalid date';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDateOnly.getTime() === today.getTime()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (today.getTime() - messageDateOnly.getTime() === 24 * 60 * 60 * 1000) {
        return 'Yesterday';
    } else if (now.getFullYear() === messageDateOnly.getFullYear()) {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
};

// Helper to get avatar URL, similar to ProfilePage
const getAvatarUrl = (profileImageUrl, nameOrEmail) => {
    if (profileImageUrl) {
        const filename = profileImageUrl.split('/').pop();
        return `http://localhost:5000/uploads/profiles/${filename}`; // Adjust path if your backend serves from a subfolder
    }
    // Fallback to ui-avatars if no profile image
    const initials = nameOrEmail ? nameOrEmail.split(' ').map(n=>n[0]).join('').substring(0,2) : 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=96&font-size=0.4&bold=true`;
};


function MyChatsPage() {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token, user, fetchUnreadMessagesCount } = useAuth();

    const fetchMyChats = useCallback(async () => {
        if (!token) {
            setError("Authentication required.");
            setLoading(false);
            return;
        }
        setLoading(true); setError(null);
        try {
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
    }, [token]);

    useEffect(() => {
        fetchMyChats();
        fetchUnreadMessagesCount(); // Fetch unread count on initial load and when chats are fetched
    }, [fetchMyChats, fetchUnreadMessagesCount]);

    useEffect(() => {
        const handleChatUpdate = () => {
            fetchMyChats();
            fetchUnreadMessagesCount(); // Also update unread count on chat-update
        };
        window.addEventListener('chat-update', handleChatUpdate);
        return () => window.removeEventListener('chat-update', handleChatUpdate);
    }, [fetchMyChats, fetchUnreadMessagesCount]);

    if (loading) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-slate-700" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Loading your chats...</div>;
    }

    if (error) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-red-600 p-10 text-center" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Error: {error}</div>;
    }

    return (
        <div className="relative flex size-full min-h-screen flex-col bg-slate-50" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
            <div className="px-4 sm:px-10 md:px-20 lg:px-40 flex flex-1 justify-center py-5">
                <div className="layout-content-container flex flex-col max-w-3xl w-full flex-1 bg-white shadow-xl rounded-lg">
                    <div className="p-6 md:p-8">
                        <h1 className="text-[#0d151c] text-2xl sm:text-3xl font-bold leading-tight tracking-tight mb-8 text-center">
                            My Chats
                        </h1>

                        {conversations.length === 0 ? (
                            <p className="text-center text-slate-600 py-10">You have no active chats yet.</p>
                        ) : (
                            <div className="space-y-1"> {/* Reduced space for tighter list */}
                                {conversations.map((convo) => {
                                    const otherParticipantName = convo.otherParticipant?.name || 'Unknown User';
                                    const otherParticipantAvatar = getAvatarUrl(convo.otherParticipant?.profile_image_url, otherParticipantName);
                                    
                                    let lastMessageContent = "No messages yet. Start the conversation!";
                                    let formattedTimestamp = "No time";
                                    let lastMessagePrefix = "";
                                    let isLastMessageUnreadByCurrentUser = false;

                                    if (convo.lastMessage) {
                                        const timestampValueFromMessage = convo.lastMessage.created_at || convo.lastMessage.createdAt || convo.lastMessage.timestamp;
                                        formattedTimestamp = formatLastMessageTimestamp(timestampValueFromMessage);
                                        lastMessageContent = convo.lastMessage.content;
                                        if (convo.lastMessage.senderId === user?.id) {
                                            lastMessagePrefix = "You: ";
                                        } else {
                                            // Use first name of other participant if available
                                            const otherFirstName = otherParticipantName.split(' ')[0];
                                            lastMessagePrefix = `${otherFirstName}: `;
                                        }
                                        isLastMessageUnreadByCurrentUser = convo.unreadCountForCurrentUser > 0 && convo.lastMessage.senderId !== user?.id;
                                    }


                                    return (
                                        <Link
                                            to={`/listings/${convo.listingId}/chat${convo.isCurrentUserListingOwner ? `?with=${convo.otherParticipant.id}` : ''}`}
                                            key={`${convo.listingId}-${convo.otherParticipant.id}`}
                                            className={`flex items-center p-4 hover:bg-slate-50 transition-colors duration-150 border-b border-slate-200 last:border-b-0 ${
                                                convo.unreadCountForCurrentUser > 0 ? 'bg-blue-50 border-l-4 border-blue-500' : '' // Subtle unread background
                                            }`}
                                        >
                                            <img
                                                src={otherParticipantAvatar}
                                                alt={otherParticipantName}
                                                className="w-12 h-12 rounded-full object-cover mr-4 shrink-0 border border-slate-200"
                                            />
                                            <div className="flex-grow overflow-hidden">
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <h2 className="text-[#0d151c] text-base sm:text-lg font-semibold truncate" title={`Chat for: ${convo.listingTitle}`}>
                                                        {convo.listingTitle}
                                                    </h2>
                                                    <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                                                        {formattedTimestamp}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-700 mb-1 truncate" title={`With: ${otherParticipantName}`}>
                                                    With: <span className="font-medium">{otherParticipantName}</span>
                                                </p>
                                                <div className="flex items-center">
                                                    <p className={`text-sm text-slate-600 truncate flex-grow ${
                                                        isLastMessageUnreadByCurrentUser ? 'font-semibold text-slate-800' : '' 
                                                    }`}>
                                                        {lastMessagePrefix}
                                                        {lastMessageContent}
                                                    </p>
                                                    {convo.unreadCountForCurrentUser > 0 && (
                                                        <span className="ml-2 shrink-0 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                                            {convo.unreadCountForCurrentUser > 9 ? '9+' : convo.unreadCountForCurrentUser}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style jsx global>{`
                .tracking-tight { letter-spacing: -0.025em; }
            `}</style>
        </div>
    );
}

export default MyChatsPage;