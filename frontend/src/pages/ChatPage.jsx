// frontend/src/pages/ChatPage.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, Link as RouterLink } from 'react-router-dom';

import api from '../api/api.js';
import { useAuth } from '../context/AuthContext';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'; // Send icon

/**
 * Formats a date string for use as a chat message header (e.g., "Сьогодні", "Вчора", "12 Січня", "12 Січня 2023").
 * @param {string} dateString - The date string to format.
 * @returns {string|null} The formatted date string or null if invalid.
 */
const formatDateHeader = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    const now = new Date();
    // Normalize to start of day for accurate comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today.getTime() - messageDateOnly.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Difference in days

    if (diffDays === 0) return 'Сьогодні';
    if (diffDays === 1) return 'Вчора';

    // Use Ukrainian locale for date formatting
    if (now.getFullYear() === messageDateOnly.getFullYear()) {
        return date.toLocaleDateString('uk-UA', { month: 'long', day: 'numeric' });
    }
    return date.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
};

/**
 * Generates an avatar URL. If a profile image URL is provided, it's used.
 * Otherwise, it generates a UI-avatars.com URL with initials.
 * @param {string|null} profileImageUrl - The URL of the user's profile photo.
 * @param {string} nameOrEmail - The user's name or email to generate initials from.
 * @param {number} size - The desired size of the avatar in pixels.
 * @returns {string} The avatar URL.
 */
const getAvatarUrl = (profileImageUrl, nameOrEmail, size = 96) => {
    if (profileImageUrl) {
       return profileImageUrl; 
    }
    const initials = nameOrEmail ? nameOrEmail.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'U'; 
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=${size}&font-size=0.4&bold=true`;
};


function ChatPage() {
    const { listingId: listingIdFromParams } = useParams();
    const [searchParams] = useSearchParams();
    const otherParticipantIdFromQuery = searchParams.get('with'); // The ID of the other user to chat with (if current user is owner)

    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(true);
    const [errorMessages, setErrorMessages] = useState(null);

    const [listing, setListing] = useState(null);
    const [loadingListing, setLoadingListing] = useState(true);
    const [errorListing, setErrorListing] = useState(null);
    
    const [chatPartnerId, setChatPartnerId] = useState(null);
    const [chatPartnerDetails, setChatPartnerDetails] = useState(null);

    const [newMessageContent, setNewMessageContent] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [errorSendingMessage, setErrorSendingMessage] = useState(null);

    // Auth context for user, token, and chat-related actions
    const { isAuthenticated, user, token, markChatAsRead, fetchUnreadMessagesCount } = useAuth(); 
    const messagesEndRef = useRef(null); // Ref for scrolling to the latest message
    const chatContainerRef = useRef(null); // Ref for the scrollable chat container


    // Effect to determine the chat partner and fetch their details
    useEffect(() => {
        const determineAndFetchPartner = async () => {
            if (!listing || !user) { // Wait for listing and current user details
                setChatPartnerId(null);
                setChatPartnerDetails(null);
                return;
            }

            let partnerIdToSet = null;
            // If the current user is the owner of the listing
            if (String(user.id) === String(listing.owner_id)) {
                // The owner must specify 'with' query param to initiate a chat with a tenant
                partnerIdToSet = otherParticipantIdFromQuery ? String(otherParticipantIdFromQuery) : null;
            } else {
                // If the current user is a tenant, the chat partner is always the listing owner
                partnerIdToSet = String(listing.owner_id);
            }
            setChatPartnerId(partnerIdToSet);

            if (partnerIdToSet) {
                try {
                    // If the partner is the owner and listing.Owner data is available, use it directly
                    if (partnerIdToSet === String(listing.owner_id) && listing.Owner) {
                         setChatPartnerDetails(listing.Owner);
                    } else if (token) { // Otherwise, fetch public profile for the partner
                        const response = await api.get(`/users/public-profile/${partnerIdToSet}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (response.data && response.data.user) {
                            setChatPartnerDetails(response.data.user);
                        } else {
                            // Fallback if user details are not found or incomplete
                            setChatPartnerDetails({ id: partnerIdToSet, name: `Користувач ${partnerIdToSet}`, email: '' });
                        }
                    }
                } catch (err) {
                    console.error("Error fetching chat partner details:", err);
                    setChatPartnerDetails({ id: partnerIdToSet, name: `Користувач ${partnerIdToSet}`, email: '' }); // Fallback on error
                }
            } else {
                setChatPartnerDetails(null); // No chat partner determined
            }
        };
        determineAndFetchPartner();
    }, [listing, user, otherParticipantIdFromQuery, token]);


    // Effect to fetch listing details
    useEffect(() => {
        const fetchListingDetails = async () => {
            if (!listingIdFromParams) {
                setErrorListing('Відсутній ІД оголошення.');
                setLoadingListing(false); return;
            }
            if (!token) {
                setErrorListing('Потрібна автентифікація для завантаження оголошення.');
                setLoadingListing(false); return;
            }

            setLoadingListing(true); setErrorListing(null);
            try {
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const listingRes = await api.get(`/listings/${listingIdFromParams}`, config);
                setListing(listingRes.data);
            } catch (err) {
                setErrorListing(err.response?.data?.message || 'Не вдалося завантажити оголошення.');
            } finally {
                setLoadingListing(false);
            }
        };
        fetchListingDetails();
    }, [listingIdFromParams, token]); // Re-run if listing ID or token changes

    // Callback to fetch initial messages and mark them as read
    const fetchInitialMessagesAndMarkRead = useCallback(async () => {
        // Ensure all necessary data is available before fetching messages
        if (!token || !user?.id || !listingIdFromParams || !listing || !chatPartnerId) {
             // If we're waiting for listing/partner, keep loading state.
             // Otherwise, if owner is missing 'with' param, show empty state immediately.
             if (!listing || !chatPartnerId) setLoadingMessages(false);
            return;
        }
        
        setLoadingMessages(true); setErrorMessages(null);
        let messagesApiUrl = `/chats/listing/${listingIdFromParams}`;
        const params = new URLSearchParams();
        // If current user is the owner, need to specify the other user's ID
        if (String(user.id) === String(listing.owner_id)) {
            params.append('otherUserId', chatPartnerId);
        }
        if (params.toString()) { // Append query params if any
            messagesApiUrl += `?${params.toString()}`;
        }
        
        try {
            const response = await api.get(messagesApiUrl, { headers: { Authorization: `Bearer ${token}` } });
            const fetchedMessages = response.data;
            setMessages(fetchedMessages);

            // Check if there are unread messages from the chat partner
            if (fetchedMessages.length > 0) {
                const hasUnreadFromPartner = fetchedMessages.some(msg => 
                    String(msg.sender_id) === String(chatPartnerId) && 
                    String(msg.receiver_id) === String(user.id) && !msg.is_read
                );
                if (hasUnreadFromPartner) {
                    // Mark them as read and update global unread count
                    await markChatAsRead(listingIdFromParams, chatPartnerId);
                    setMessages(prev => prev.map(msg => 
                        (String(msg.sender_id) === String(chatPartnerId) && String(msg.receiver_id) === String(user.id))
                        ? { ...msg, is_read: true } : msg
                    ));
                    fetchUnreadMessagesCount();
                }
            }
        } catch (err) {
            setErrorMessages(err.response?.data?.message || 'Не вдалося завантажити повідомлення.');
        } finally {
            setLoadingMessages(false);
        }
    }, [token, user?.id, listingIdFromParams, listing, chatPartnerId, markChatAsRead, fetchUnreadMessagesCount]); // All dependencies are stable or primitives

    // Effect to trigger initial message fetch once dependencies are met
    useEffect(() => {
        if (listing && user && chatPartnerId && token) {
            fetchInitialMessagesAndMarkRead();
        } else if (listing && user && String(user.id) === String(listing.owner_id) && !otherParticipantIdFromQuery) {
            // Special case: owner navigated to chat page for their listing without specifying a 'with' param
            // This means they haven't selected a specific conversation yet.
            setMessages([]); setLoadingMessages(false); setErrorMessages(null);
        }
    }, [listing, user, chatPartnerId, token, fetchInitialMessagesAndMarkRead, otherParticipantIdFromQuery]);

    // Effect to handle real-time chat updates (via custom event from AuthContext/Socket.IO)
    useEffect(() => {
        const handleChatUpdate = (event) => {
            const data = event.detail;
            if (data.message && String(data.listingId) === String(listingIdFromParams) && user?.id && chatPartnerId) {
                const incomingMessage = data.message;
                const isRelevant =
                    (String(incomingMessage.sender_id) === String(user.id) && String(incomingMessage.receiver_id) === String(chatPartnerId)) || // Message sent by current user
                    (String(incomingMessage.sender_id) === String(chatPartnerId) && String(incomingMessage.receiver_id) === String(user.id)); // Message received by current user

                if (isRelevant) {
                    setMessages(prevMessages => {
                        // Prevent duplicate messages if already added (e.g., from optimistic update or race conditions)
                        if (prevMessages.find(m => m.id === incomingMessage.id)) return prevMessages;
                        return [...prevMessages, incomingMessage];
                    });
                    // If the incoming message is from the partner TO the current user, mark it as read
                    if (String(incomingMessage.sender_id) === String(chatPartnerId) && String(incomingMessage.receiver_id) === String(user.id)) {
                        markChatAsRead(listingIdFromParams, chatPartnerId).then(() => fetchUnreadMessagesCount());
                    }
                }
            } else if (data.type === 'read_update' && String(data.listingId) === String(listingIdFromParams) && String(data.chatPartnerId) === String(chatPartnerId) ) {
                // If a read receipt comes, update `is_read` status for messages sent by current user to this partner
                 setMessages(prev => prev.map(msg => 
                    (String(msg.sender_id) === String(user.id) && String(msg.receiver_id) === String(chatPartnerId))
                    ? { ...msg, is_read: true } : msg
                 ));
            }
        };
        // Listen to the custom 'chat-update' event dispatched by the AuthContext (which listens to Socket.IO)
        window.addEventListener('chat-update', handleChatUpdate);
        return () => window.removeEventListener('chat-update', handleChatUpdate); // Cleanup
    }, [listingIdFromParams, user?.id, chatPartnerId, markChatAsRead, fetchUnreadMessagesCount]);

    // Effect to auto-scroll to the bottom of the chat
    useEffect(() => {
        if (messagesEndRef.current && messages.length > 0) {
            const container = chatContainerRef.current;
            if (container) {
                // Check if user is scrolled up significantly
                const isScrolledUp = container.scrollHeight - container.scrollTop > container.clientHeight + 150;
                // Auto-scroll only if not scrolled up, or if the last message was sent by the current user
                const lastMessage = messages[messages.length -1];
                if (!isScrolledUp || (lastMessage && String(lastMessage.sender_id) === String(user?.id))) {
                    setTimeout(() => messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }), 100); 
                }
            }
        }
    }, [messages, user?.id]); // Re-scroll when messages update or user changes

    // Handler for sending a new message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessageContent.trim() || !chatPartnerId) {
            setErrorSendingMessage("Не вдалося надіслати повідомлення. Відсутній одержувач або вміст."); 
            setTimeout(() => setErrorSendingMessage(null), 3000); // Clear error after 3 seconds
            return;
        }
        setSendingMessage(true); setErrorSendingMessage(null);
        const messageData = { listing_id: listingIdFromParams, content: newMessageContent, receiver_id: chatPartnerId };
        try {
            const response = await api.post(`/chats/send`, messageData, { headers: { Authorization: `Bearer ${token}` } });
            if(response.data.newMessage) {
                 setMessages(prev => {
                    // Prevent duplicate messages
                    if (prev.find(m => m.id === response.data.newMessage.id)) return prev;
                    return [...prev, response.data.newMessage];
                 });
            }
            setNewMessageContent(''); // Clear input field
            // Note: Socket eligibility check removed. Socket connection should be managed at a higher level.
        } catch (err) {
            setErrorSendingMessage(err.response?.data?.message || 'Не вдалося надіслати повідомлення.');
            setTimeout(() => setErrorSendingMessage(null), 3000); // Clear error after 3 seconds
        } finally {
            setSendingMessage(false);
        }
    };

    // Determine overall loading state for the page
    const isLoadingPage = loadingListing || (loadingMessages && messages.length === 0 && !errorMessages && chatPartnerId);

    // Conditional rendering for various page states
    if (isLoadingPage && !listing) { // Display loading for initial page load
        return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-slate-700" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Завантаження чату...</div>;
    }
    if (errorListing) { // Display error if listing details couldn't be loaded
        return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-red-600 p-10 text-center" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Помилка: {errorListing}</div>;
    }
    if (!listing && !errorListing && !loadingListing) { // If no listing found after load
        return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-slate-700 p-10 text-center" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Оголошення не знайдено.</div>;
    }
    
    // Determine if message sending is possible
    const canSendMessage = isAuthenticated && user && listing && chatPartnerId;

    // Group messages by date for display with date headers
    const groupedMessages = [];
    let lastDateHeader = null;
    messages.forEach(message => {
        const messageDateStr = message.created_at || message.createdAt;
        if (!messageDateStr) { // Fallback if date is missing
            groupedMessages.push({ type: 'message', data: message }); 
            return; 
        }
        const currentDateHeader = formatDateHeader(messageDateStr);
        if (currentDateHeader && currentDateHeader !== lastDateHeader) {
            groupedMessages.push({ type: 'date_header', date: currentDateHeader });
            lastDateHeader = currentDateHeader;
        }
        groupedMessages.push({ type: 'message', data: message });
    });

    return (
            <div className="relative flex size-full min-h-screen flex-col bg-slate-50" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
                <div className="px-4 sm:px-6 md:px-8 flex flex-1 justify-center py-5">
                <div className="layout-content-container flex flex-col max-w-2xl w-full flex-1 bg-white shadow-xl rounded-lg overflow-hidden h-[calc(100vh-5rem)] sm:h-[calc(100vh-6rem)]"> {/* Fixed height chat window */}
                    
                    {/* Chat Header */}
                    <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center space-x-3 shrink-0">
                        {chatPartnerDetails && (
                            <RouterLink to={`/profiles/${chatPartnerDetails.id}`}>
                                <img
                                    src={getAvatarUrl(chatPartnerDetails.profile_photo_url, chatPartnerDetails.name || chatPartnerDetails.email, 40)}
                                    alt={chatPartnerDetails.name || `Користувач ${chatPartnerDetails.id}`}
                                    className="w-10 h-10 rounded-full object-cover border border-slate-200 hover:opacity-80"
                                />
                            </RouterLink>
                        )}
                         {/* Loading state for chat partner avatar */}
                         {!chatPartnerDetails && chatPartnerId && (
                            <div className="w-10 h-10 rounded-full bg-slate-300 animate-pulse"></div>
                         )}
                        <div className="overflow-hidden">
                            <h1 className="text-[#0d151c] text-base sm:text-lg font-semibold leading-tight tracking-tight truncate">
                                {listing?.title ? (
                                    <>Чат для <RouterLink to={`/listings/${listingIdFromParams}`} className="text-blue-600 hover:underline">{listing.title}</RouterLink></>
                                ) : "Чат"}
                            </h1>
                            {chatPartnerDetails && (
                                <p className="text-xs sm:text-sm text-slate-500 truncate">
                                    З <RouterLink to={`/profiles/${chatPartnerDetails.id}`} className="hover:underline">
                                        {chatPartnerDetails.name || chatPartnerDetails.email || `Користувач ${chatPartnerDetails.id}`}
                                    </RouterLink>
                                    {String(chatPartnerDetails.id) === String(listing?.owner_id) && " (Власник)"}
                                </p>
                            )}
                            {/* Message for owners who haven't selected a conversation */}
                            {!chatPartnerId && user && listing && String(user.id) === String(listing.owner_id) && !loadingListing && (
                                <p className="text-xs text-orange-500 mt-0.5">Виберіть розмову з розділу "Мої чати".</p>
                            )}
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 sm:space-y-3 bg-slate-50/50">
                        {/* Loading/Error/Empty states for messages */}
                        {loadingMessages && messages.length === 0 && ( 
                            <p className="text-center text-slate-600 m-auto">Завантаження повідомлень...</p>
                        )}
                        {errorMessages && messages.length === 0 && !loadingMessages &&(
                            <p className="text-center text-red-500 m-auto">Помилка: {errorMessages}</p>
                        )}
                        {!loadingMessages && messages.length === 0 && !errorMessages && ( 
                            <p className="text-center text-slate-600 m-auto">
                                {canSendMessage ? "Повідомлень поки немає. Надішліть перше, щоб почати!" : 
                                (user && listing && String(user.id) === String(listing.owner_id) && !chatPartnerId ? 
                                    "Виберіть розмову." : 
                                    (isAuthenticated ? "У цьому чаті немає повідомлень." : "Увійдіть, щоб спілкуватися.")
                                )}
                            </p>
                        )}

                        {/* Render grouped messages and date headers */}
                        {groupedMessages.map((item, index) => {
                            if (item.type === 'date_header') {
                                return (
                                    <div key={`header-${index}`} className="text-center my-4">
                                        <span className="text-xs text-slate-500 bg-slate-200 px-3 py-1 rounded-full">
                                            {item.date}
                                        </span>
                                    </div>
                                );
                            }
                            const message = item.data;
                            const isCurrentUserSender = String(message.sender_id) === String(user?.id);
                            const senderDetails = isCurrentUserSender ? user : chatPartnerDetails; // Get details for sender

                            return (
                                <div key={message.id || `msg-${index}`} className={`flex items-end w-full my-1 ${isCurrentUserSender ? 'justify-end' : 'justify-start'}`}>
                                    {/* Sender's avatar (for messages not sent by current user) */}
                                    {!isCurrentUserSender && senderDetails && (
                                        <RouterLink to={`/profiles/${senderDetails.id}`} className="flex-shrink-0 self-end mb-1">
                                            <img
                                                src={getAvatarUrl(senderDetails.profile_photo_url, senderDetails.name || senderDetails.email, 32)}
                                                alt={senderDetails.name || 'Користувач'}
                                                className="w-8 h-8 rounded-full mr-2 object-cover hover:opacity-80"
                                            />
                                        </RouterLink>
                                    )}
                                    {/* Message bubble */}
                                    <div className={`px-3 py-2 max-w-[75%] sm:max-w-[65%] shadow-sm ${
                                        isCurrentUserSender 
                                        ? 'bg-blue-600 text-white rounded-xl rounded-br-sm' 
                                        : 'bg-slate-200 text-[#0d151c] rounded-xl rounded-bl-sm'
                                    }`}>
                                        <p className="break-words text-sm leading-snug">{message.content}</p>
                                        <div className={`text-xs mt-1 opacity-80 ${isCurrentUserSender ? 'text-blue-100' : 'text-slate-500'} text-right`}>
                                            {/* Using Ukrainian locale for time */}
                                            {new Date(message.created_at || message.createdAt).toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'})}
                                            {/* Read status indicator for current user's sent messages */}
                                            {isCurrentUserSender && message.is_read && <span className="ml-1 opacity-90">✓✓</span>}
                                            {isCurrentUserSender && !message.is_read && <span className="ml-1 opacity-70">✓</span>}
                                        </div>
                                    </div>
                                    {/* Current user's avatar (for messages sent by current user) */}
                                    {isCurrentUserSender && user && (
                                        <RouterLink to={`/profile`} className="flex-shrink-0 self-end mb-1">
                                            <img
                                                src={getAvatarUrl(user.profile_photo_url, user.name || user.email, 32)}
                                                alt={user.name || 'Ви'}
                                                className="w-8 h-8 rounded-full ml-2 object-cover hover:opacity-80"
                                            />
                                        </RouterLink>
                                    )}
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} /> {/* Scroll target */}
                    </div>

                    {/* Message Input Area */}
                    {canSendMessage ? (
                        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white shrink-0">
                            {errorSendingMessage && <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-1.5 rounded-md mb-2 text-xs">{errorSendingMessage}</div>}
                            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                                <input
                                    className="form-input flex-grow rounded-lg border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c] placeholder-slate-400 py-2.5 px-3.5"
                                    type="text"
                                    placeholder="Введіть ваше повідомлення..."
                                    value={newMessageContent}
                                    onChange={(e) => setNewMessageContent(e.target.value)}
                                    disabled={sendingMessage}
                                    autoFocus // Automatically focus the input field
                                />
                                <button
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 flex items-center justify-center"
                                    type="submit"
                                    disabled={sendingMessage || !newMessageContent.trim()} // Disable if empty or sending
                                    aria-label="Надіслати повідомлення"
                                >
                                    <PaperAirplaneIcon className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="p-4 border-t border-slate-200 bg-slate-100 text-center text-sm text-slate-600 shrink-0">
                            {!isAuthenticated ? <RouterLink to={`/login?redirect=${window.location.pathname}${window.location.search}`} className="text-blue-600 hover:underline font-medium">Увійдіть</RouterLink> :
                            (user && listing && String(user.id) === String(listing.owner_id) && !chatPartnerId ? 
                                "Виберіть користувача для спілкування з розділу 'Мої чати'." : 
                                "Наразі ви не можете надсилати повідомлення в цьому чаті."
                            )}
                        </div>
                    )}
                </div>
            </div>
            {/* Global Tailwind CSS styles (if not using PostCSS/Tailwind JIT in development) */}
            <style jsx global>{`
                .form-input { @apply shadow-sm; }
                .tracking-tight { letter-spacing: -0.025em; }
            `}</style>
        </div>
    );
}

export default ChatPage;