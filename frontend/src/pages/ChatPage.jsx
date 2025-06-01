// frontend/src/pages/ChatPage.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:5000/api';

// Helper function to format date for chat headers
const formatDateHeader = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null; // Return null for invalid dates

    const now = new Date();
    // Normalize dates to just year, month, day for comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDateOnly.getTime() === today.getTime()) {
        return 'Today';
    } else if (today.getTime() - messageDateOnly.getTime() === 24 * 60 * 60 * 1000) { // Check for yesterday
        return 'Yesterday';
    } else if (now.getFullYear() === messageDateOnly.getFullYear()) {
        return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }); // e.g., August 15
    } else {
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); // e.g., August 15, 2023
    }
};


function ChatPage() {
    const { listingId: listingIdFromParams } = useParams();
    const [searchParams] = useSearchParams();
    const otherParticipantIdFromQuery = searchParams.get('with');

    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(true);
    const [errorMessages, setErrorMessages] = useState(null);

    const [listing, setListing] = useState(null);
    const [loadingListing, setLoadingListing] = useState(true);
    const [errorListing, setErrorListing] = useState(null);
    
    const [chatPartnerId, setChatPartnerId] = useState(null); // ID of the other user in chat

    const [newMessageContent, setNewMessageContent] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [errorSendingMessage, setErrorSendingMessage] = useState(null);

    const { isAuthenticated, user, token, markChatAsRead } = useAuth(); // Removed socket, using global event
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null); // Ref for the scrollable chat container

    // Effect to determine chatPartnerId
    useEffect(() => {
        if (listing && user) {
            if (String(user.id) === String(listing.owner_id)) { // Current user is owner
                setChatPartnerId(otherParticipantIdFromQuery ? String(otherParticipantIdFromQuery) : null);
            } else { // Current user is tenant/other
                setChatPartnerId(String(listing.owner_id));
            }
        } else {
            setChatPartnerId(null); // Reset if listing or user is not available
        }
    }, [listing, user, otherParticipantIdFromQuery]);


    // Fetch listing details
    useEffect(() => {
        const fetchListingDetails = async () => {
            if (!listingIdFromParams || !token) {
                setErrorListing(!listingIdFromParams ? 'Listing ID missing.' : 'Authentication required.');
                setLoadingListing(false);
                return;
            }
            setLoadingListing(true);
            setErrorListing(null);
            try {
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const listingRes = await axios.get(`${API_URL}/listings/${listingIdFromParams}`, config);
                setListing(listingRes.data);
            } catch (err) {
                console.error('Error fetching listing details:', err);
                setErrorListing(err.response?.data?.message || 'Failed to load listing details.');
            } finally {
                setLoadingListing(false);
            }
        };
        fetchListingDetails();
    }, [listingIdFromParams, token]);

    // Fetch initial messages and mark as read
    const fetchInitialMessagesAndMarkRead = useCallback(async () => {
        if (!token || !user?.id || !listingIdFromParams || !listing || !chatPartnerId) {
             if (!listing || !chatPartnerId) setLoadingMessages(false); // Allow UI to show "select chat" if owner has no ?with=
            return;
        }
        
        setLoadingMessages(true);
        setErrorMessages(null);
        
        let messagesApiUrl = `${API_URL}/chats/listing/${listingIdFromParams}`;
        const params = new URLSearchParams();

        if (String(user.id) === String(listing.owner_id)) { // Current user is owner
            params.append('otherUserId', chatPartnerId); // chatPartnerId must be set
        }
        // For tenant, backend infers chat is with owner, no otherUserId needed in query.

        if (params.toString()) {
            messagesApiUrl += `?${params.toString()}`;
        }
        const config = { headers: { Authorization: `Bearer ${token}` } };

        try {
            const response = await axios.get(messagesApiUrl, config);
            const fetchedMessages = response.data;
            setMessages(fetchedMessages);

            // Mark messages as read after fetching
            if (fetchedMessages.length > 0) {
                // Check if there are any messages from the partner that are unread
                const hasUnreadFromPartner = fetchedMessages.some(
                    msg => String(msg.sender_id) === String(chatPartnerId) && 
                           String(msg.receiver_id) === String(user.id) && 
                           !msg.is_read
                );
                if (hasUnreadFromPartner) {
                    await markChatAsRead(listingIdFromParams, chatPartnerId);
                    // Optimistically update local messages' is_read status
                    setMessages(prev => prev.map(msg => 
                        (String(msg.sender_id) === String(chatPartnerId) && String(msg.receiver_id) === String(user.id))
                        ? { ...msg, is_read: true }
                        : msg
                    ));
                }
            }
        } catch (err) {
            console.error('Error fetching initial messages:', err);
            setErrorMessages(err.response?.data?.message || 'Failed to load messages.');
        } finally {
            setLoadingMessages(false);
        }
    }, [token, user?.id, listingIdFromParams, listing, chatPartnerId, markChatAsRead]);

    useEffect(() => {
        // Trigger initial fetch only when all necessary data is available
        if (listing && user && chatPartnerId && token) {
            fetchInitialMessagesAndMarkRead();
        } else if (listing && user && String(user.id) === String(listing.owner_id) && !otherParticipantIdFromQuery) {
            // Owner viewing chat for their listing but no specific participant selected
            setMessages([]); // Clear messages
            setLoadingMessages(false); // Stop loading
            setErrorMessages(null);
        }
    }, [listing, user, chatPartnerId, token, fetchInitialMessagesAndMarkRead, otherParticipantIdFromQuery]);


    // Listen to global chat updates (from AuthContext's socket handling)
    useEffect(() => {
        const handleChatUpdate = (event) => {
            const data = event.detail;
            console.log('ChatPage received chat-update event:', data);

            if (data.message && String(data.listingId) === String(listingIdFromParams) && user?.id && chatPartnerId) {
    const incomingMessage = data.message;

    const isListingMatch = String(data.listingId) === String(listingIdFromParams);
    const hasUserId = Boolean(user?.id);
    const hasChatPartnerId = Boolean(chatPartnerId);

    const isRelevant =
        (String(incomingMessage.sender_id) === String(user.id) && String(incomingMessage.receiver_id) === String(chatPartnerId)) ||
        (String(incomingMessage.sender_id) === String(chatPartnerId) && String(incomingMessage.receiver_id) === String(user.id));

    console.log('Checking conditions before setting messages:');
    console.log(`- listingId match: ${isListingMatch}`);
    console.log(`- has user ID: ${hasUserId}`);
    console.log(`- has chat partner ID: ${hasChatPartnerId}`);
    console.log(`- isRelevant: ${isRelevant}`);

    if (isRelevant) {
        setMessages(prevMessages => {
            const alreadyExists = prevMessages.find(m => m.id === incomingMessage.id);
            if (alreadyExists) {
                console.log('Updating messages for read status.');
                return prevMessages;
            }
            console.log('Updating messages state in ChatPage with new message.');
            return [...prevMessages, incomingMessage];
        });

        // If the new message is from the chat partner, mark it as read
        const isFromPartner = String(incomingMessage.sender_id) === String(chatPartnerId);
        const isToUser = String(incomingMessage.receiver_id) === String(user.id);
        if (isFromPartner && isToUser) {
            markChatAsRead(listingIdFromParams, chatPartnerId);
        }
    }
}
 else if (data.type === 'read_update' && String(data.listingId) === String(listingIdFromParams)) {
                 // This means the other user read messages sent by me.
                 // If messages sent by current user to chatPartnerId were marked read.
                 if (String(data.chatPartnerId) === String(chatPartnerId)) { // Partner read MY messages
                    // For future "seen by" UI: re-fetch or optimistically update is_read for messages sent by user.id
                    // For now, just log it. Header badge is already updated by AuthContext.
                    console.log(`Messages to ${chatPartnerId} were read.`);
                    // Optionally, refetch messages to update their is_read status if displaying "seen" ticks
                    // fetchInitialMessagesAndMarkRead(); // This might be too much, depends on UI needs
                 }
            }
        };

        window.addEventListener('chat-update', handleChatUpdate);
        return () => {
            window.removeEventListener('chat-update', handleChatUpdate);
        };
    }, [listingIdFromParams, user?.id, chatPartnerId, markChatAsRead]);

    // Effect for scrolling to the bottom of messages
    useEffect(() => {
        if (messagesEndRef.current && messages.length > 0) {
            const container = chatContainerRef.current;
            if (container) {
                // Check if user is scrolled up (not near the bottom)
                // If the user has scrolled up, don't auto-scroll unless the new message is from the current user
                const isScrolledUp = container.scrollHeight - container.scrollTop > container.clientHeight + 100; // 100px tolerance
                if (!isScrolledUp || messages[messages.length -1]?.sender_id === user?.id) { // Always scroll if current user sent
                    setTimeout(() => {
                        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                    }, 100); 
                }
            } else {
                 // Fallback if ref isn't attached (shouldn't happen but for safety)
                 setTimeout(() => {
                    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                 }, 100);
            }
        }
    }, [messages, user?.id]); // Re-run when messages change or user ID changes

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessageContent.trim() || !listing || !user || !token || !chatPartnerId) {
            setErrorSendingMessage("Cannot send message. Missing information or recipient.");
            return;
        }

        setSendingMessage(true);
        setErrorSendingMessage(null);

        const messageData = {
            listing_id: listingIdFromParams,
            content: newMessageContent,
            receiver_id: chatPartnerId, // Receiver is always the chatPartnerId
        };

        try {
            // Use POST /api/chats/send
            const response = await axios.post(
                `${API_URL}/chats/send`,
                messageData,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Optimistically add the new message (server responds with the created message)
            // The socket event will also arrive, but this provides faster UI feedback.
            // The listener above should handle potential duplicates if socket event is fast.
            if(response.data.newMessage) { // Ensure key matches controller response
                 setMessages(prevMessages => {
                    if (prevMessages.find(m => m.id === response.data.newMessage.id)) return prevMessages; // Avoid duplicate from fast socket
                    return [...prevMessages, response.data.newMessage];
                 });
            }
            setNewMessageContent('');
        } catch (err) {
            console.error('Error sending message:', err);
            setErrorSendingMessage(err.response?.data?.message || 'Failed to send message.');
        } finally {
            setSendingMessage(false);
        }
    };

    const isLoadingPage = loadingListing || (loadingMessages && messages.length === 0 && !errorMessages);

    if (isLoadingPage && !listing) { 
        return <div className="container mx-auto px-4 py-8 text-center">Loading chat details...</div>;
    }
    if (errorListing) {
        return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {errorListing}</div>;
    }
    if (!listing && !errorListing && !loadingListing) {
        return <div className="container mx-auto px-4 py-8 text-center">Listing not found or access denied.</div>;
    }
    
    // Determine if current user can send messages
    const canSendMessage = isAuthenticated && user && listing && chatPartnerId;

    // Determine the details of the other participant for the chat header
    let otherUserDetails = null;
    if (listing && user && chatPartnerId) {
        if (String(user.id) === String(listing.owner_id)) { // Current user is owner
            // Find the other participant from messages if available
            const participantMessage = messages.find(m =>
                String(m.sender_id) === String(chatPartnerId) || String(m.receiver_id) === String(chatPartnerId)
            );
            if (participantMessage) {
                otherUserDetails = String(participantMessage.sender_id) === String(chatPartnerId) ? participantMessage.Sender : participantMessage.Receiver;
            } else if (messages.length > 0 && messages[0].Receiver && String(messages[0].Receiver.id) === String(chatPartnerId) ) {
                otherUserDetails = messages[0].Receiver; // Fallback if Sender is not populated or vice-versa
            } else if (messages.length > 0 && messages[0].Sender && String(messages[0].Sender.id) === String(chatPartnerId) ) {
                otherUserDetails = messages[0].Sender;
            }
            // If no messages yet, we might not have `otherUserDetails` full profile info, only ID
            // This could be improved by fetching user details for chatPartnerId if not in messages
            if(!otherUserDetails && chatPartnerId) otherUserDetails = {id: chatPartnerId, name: `User ${chatPartnerId}`};

        } else { // Current user is not owner, so chatPartnerId is owner's ID
            otherUserDetails = listing.Owner; // Assuming listing.Owner is populated
        }
    }

    // Group messages by date for rendering
    const groupedMessages = [];
    let lastDateHeader = null;
    messages.forEach(message => {
        const messageDateStr = message.created_at || message.createdAt; // Use created_at or createdAt
        if (!messageDateStr) { // Skip if no valid timestamp
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
        <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen flex flex-col">
            <div className="mb-4 text-center">
                <h1 className="text-2xl font-bold text-gray-800">
                    Chat
                    {listing?.title && (
                        <> for <RouterLink to={`/listings/${listingIdFromParams}`} className="text-blue-600 hover:underline">{listing.title}</RouterLink></>
                    )}
                </h1>
                {otherUserDetails && (
                    <p className="text-sm text-gray-600">
                        with{' '}
                        <RouterLink to={`/profiles/${otherUserDetails.id}`} className="font-semibold text-blue-600 hover:underline">
                            {otherUserDetails.name || otherUserDetails.email || `User ${otherUserDetails.id}`}
                        </RouterLink>
                        {listing && user && String(user.id) !== String(listing.owner_id) && listing.Owner && String(otherUserDetails.id) === String(listing.Owner.id) && " (Owner)"}
                    </p>
                )}
                 {!chatPartnerId && user && listing && String(user.id) === String(listing.owner_id) && !loadingListing && (
                     <p className="text-sm text-orange-600 mt-1">Please select a conversation from 'My Chats' to interact.</p>
                 )}
            </div>

            <div ref={chatContainerRef} className="flex-1 bg-white p-4 rounded-sm shadow-sm overflow-y-auto h-96 mb-4 flex flex-col space-y-1"> {/* Changed space-y-3 to space-y-1 */}
                {loadingMessages && messages.length === 0 && ( 
                    <p className="text-center text-gray-700 m-auto">Loading messages...</p>
                )}
                {errorMessages && messages.length === 0 && !loadingMessages &&(
                     <p className="text-center text-red-500 m-auto">Error loading messages: {errorMessages}</p>
                )}
                {!loadingMessages && messages.length === 0 && !errorMessages && ( 
                    <p className="text-center text-gray-700 m-auto">
                        {canSendMessage ? "No messages yet. Be the first to send one!" : 
                         (user && listing && String(user.id) === String(listing.owner_id) && !chatPartnerId ? 
                            "Select a conversation from 'My Chats' to load messages." : 
                            (isAuthenticated ? "No messages in this chat." : "Please log in to view chat.")
                        )}
                    </p>
                )}

                {groupedMessages.map((item, index) => {
                    if (item.type === 'date_header') {
                        return (
                            <div key={`header-${index}`} className="text-center my-3">
                                <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                    {item.date}
                                </span>
                            </div>
                        );
                    }
                    // item.type === 'message'
                    const message = item.data;
                    const isCurrentUserSender = String(message.sender_id) === String(user?.id);
                    const messageParticipant = isCurrentUserSender ? message.Receiver : message.Sender;

                    return (
                        <div
                            key={message.id || `msg-${index}`} // Fallback key for optimistic updates before ID
                            className={`flex items-end w-full my-1 ${isCurrentUserSender ? 'justify-end' : 'justify-start'}`}
                        >
                            {!isCurrentUserSender && messageParticipant && (
                                <RouterLink to={`/profiles/${messageParticipant.id}`} className="flex-shrink-0"> {/* Added flex-shrink-0 */}
                                    <img
                                        src={messageParticipant.profile_photo_url ? `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/uploads/profiles/${messageParticipant.profile_photo_url}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(messageParticipant.name || messageParticipant.email || 'U')}&background=random`}
                                        alt={messageParticipant.name || 'User'}
                                        title={`View profile of ${messageParticipant.name || 'User'}`}
                                        className="w-8 h-8 rounded-full mr-2 object-cover self-start hover:opacity-80"
                                    />
                                </RouterLink>
                            )}
                            <div className={`rounded-lg p-2.5 max-w-[70%] md:max-w-[60%] shadow-sm ${ // Adjusted padding and max-width
                                isCurrentUserSender ? 'bg-blue-500 text-white ml-auto' : 'bg-gray-200 text-gray-800'
                            }`}>
                                {!isCurrentUserSender && messageParticipant && (
                                     <RouterLink to={`/profiles/${messageParticipant.id}`} className="text-xs font-semibold mb-0.5 opacity-80 hover:underline text-gray-700 hover:text-gray-900 block">
                                        {messageParticipant.name || messageParticipant.email}
                                     </RouterLink>
                                )}
                                <p className="break-words text-sm">{message.content}</p> {/* Adjusted text size */}
                                 <div className={`text-xs mt-1 opacity-75 ${isCurrentUserSender ? 'text-blue-100' : 'text-gray-600'} text-right`}> {/* Adjusted text color */}
                                    {new Date(message.created_at || message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 </div>
                            </div>
                            {isCurrentUserSender && user && (
                                <RouterLink to={`/profile`} className="flex-shrink-0"> {/* Added flex-shrink-0 */}
                                    <img
                                        src={user.profile_photo_url ? `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/uploads/profiles/${user.profile_photo_url}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'U')}&background=random`}
                                        alt={user.name || 'You'}
                                        title="View your profile"
                                        className="w-8 h-8 rounded-full ml-2 object-cover self-start hover:opacity-80"
                                    />
                                </RouterLink>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {canSendMessage ? (
                 <div className="bg-white p-4 rounded-sm shadow-sm">
                     {errorSendingMessage && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative mb-2 text-sm">{errorSendingMessage}</div>}
                    <form onSubmit={handleSendMessage} className="flex">
                        <input
                            className="flex-grow shadow appearance-none border border-gray-300 rounded-l-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            type="text"
                            placeholder="Type a message..."
                            value={newMessageContent}
                            onChange={(e) => setNewMessageContent(e.target.value)}
                            disabled={sendingMessage}
                        />
                        <button
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r-sm focus:outline-none focus:shadow-outline disabled:opacity-50"
                            type="submit"
                            disabled={sendingMessage || !newMessageContent.trim()}
                        >
                            {sendingMessage ? 'Sending...' : 'Send'}
                        </button>
                    </form>
                 </div>
            ) : (
                 <div className="bg-gray-100 p-4 rounded-sm text-center text-gray-700">
                     {!isAuthenticated ? "Please log in to send a message." :
                      (user && listing && String(user.id) === String(listing.owner_id) && !chatPartnerId ? 
                        "To reply to a specific user, please select their conversation from 'My Chats'." : 
                        "You cannot send messages in this chat at the moment."
                     )}
                 </div>
            )}
        </div>
    );
}

export default ChatPage;