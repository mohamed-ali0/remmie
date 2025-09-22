// Chatbox.jsx
import { IconDots, IconMessage, IconMinus, IconSend } from '@tabler/icons-react';
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Form } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import chatadminimg from "/src/assets/images/icon_sale.svg";
import { useChat } from '../context/ChatContext'; // ✅ Import context hook
import { getToken } from '../utils/auth';

export default function Chatbox() {
    const { isChatOpen, toggleChat, closeChat } = useChat(); // ✅ Use context state
    const [inputMessage, setInputMessage] = useState('');
    const [messages, setMessages] = useState([]);

    // SessionId stored in localStorage to persist
    
    // const [sessionId, setSessionId] = useState(() => {
    //     const storedId = localStorage.getItem("chat_session_id");
    //     if (storedId) return storedId;
    //     const newId = crypto.randomUUID();
    //     localStorage.setItem("chat_session_id", newId);
    //     return newId;
    // });

    const [sessionId, setSessionId] = useState(() => {
        return crypto.randomUUID();
    });

    const messagesEndRef = useRef(null);

    // ✅ Decode userId from JWT
    const token = getToken();
    let userId = null;
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId =  btoa(payload.userId); // or payload.user_id depending on backend
        } catch (err) {
            console.error("JWT decode error:", err);
        }
    }


    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);
    useEffect(() => {
        if (token && userId) {
            loadChatHistory();
        }
    }, [token, userId]);

    const loadChatHistory = async () => {
        try {
            console.log('Loading chat history for user:', userId);
            
            // Load chat history from backend bookings-chat API
            const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/bookings-chat/find-user-message`, {
                userId: userId
            }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            
            if (response.data && response.data.sessions) {
                // Convert backend format to frontend format
                const allMessages = [];
                Object.values(response.data.sessions).forEach(sessionMessages => {
                    sessionMessages.forEach(msg => {
                        allMessages.push({
                            sender: msg.sender,
                            text: msg.message
                        });
                    });
                });
                
                if (allMessages.length > 0) {
                    setMessages(allMessages);
                    console.log('Loaded', allMessages.length, 'messages from history');
                }
            } else {
                // No history found, show welcome message
                const firstName = localStorage.getItem('first_name') || "";
                const lastName = localStorage.getItem('last_name') || "";
                const welcomeMsg = {
                    sender: "bot",
                    text: `Hello ${firstName} ${lastName}! I'm Remmie, your travel booking assistant. I'm here to help you plan your perfect trip. How can I help you today, my friend?`
                };
                setMessages([welcomeMsg]);
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            // Fallback to welcome message
            const firstName = localStorage.getItem('first_name') || "";
            const lastName = localStorage.getItem('last_name') || "";
            const welcomeMsg = {
                sender: "bot",
                text: `Hello ${firstName} ${lastName}! I'm Remmie, your travel booking assistant. I'm here to help you plan your perfect trip. How can I help you today, my friend?`
            };
            setMessages([welcomeMsg]);
        }
    };

    const sendMessage = async () => {
        if (!inputMessage.trim()) return;

        const userMsg = { sender: 'user', text: inputMessage };
        setMessages(prev => [...prev, userMsg]);
        setInputMessage('');

        try {
            // Step 1: Store USER message to backend
            await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/bookings-chat/store-message`, {
                sessionId: sessionId,
                message: inputMessage,
                sender: 'user',
                userId: userId
            });

            // Step 2: Get user's flight history and chat context for N8N
            let userContext = {};
            try {
                // Get user profile from backend API
                const userProfileResponse = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/user-info`, {}, {
                    headers: { Authorization: `Bearer ${getToken()}` }
                });

                // Get chat history
                const chatHistoryResponse = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/bookings-chat/find-user-message`, {
                    userId: userId
                }, {
                    headers: { Authorization: `Bearer ${getToken()}` }
                });
                
                // Get flight booking history
                const flightHistoryResponse = await axios.post(`${import.meta.env.VITE_API_URL}/booking/get-user-booking-list`, {}, {
                    headers: { Authorization: `Bearer ${getToken()}` }
                });
                
                const userProfile = userProfileResponse.data?.data || {};
                
                // Process chat history from sessions format
                const chatHistory = [];
                if (chatHistoryResponse.data?.sessions) {
                    Object.values(chatHistoryResponse.data.sessions).forEach(sessionMessages => {
                        sessionMessages.forEach(msg => {
                            chatHistory.push({
                                sender: msg.sender,
                                message: msg.message,
                                created_at: msg.created_at
                            });
                        });
                    });
                }

                userContext = {
                    chatHistory: chatHistory,
                    flightHistory: flightHistoryResponse.data?.bookings || [],
                    userProfile: {
                        firstName: userProfile.first_name || localStorage.getItem('first_name') || '',
                        lastName: userProfile.last_name || localStorage.getItem('last_name') || '',
                        email: userProfile.email || localStorage.getItem('email') || '',
                        mobile: userProfile.mobile || '',
                        userId: userId,
                        fullName: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
                    }
                };
                
                console.log('User context for N8N:', userContext);
            } catch (contextError) {
                console.warn('Could not load user context:', contextError);
                // Fallback to localStorage
                userContext = {
                    chatHistory: [],
                    flightHistory: [],
                    userProfile: {
                        firstName: localStorage.getItem('first_name') || '',
                        lastName: localStorage.getItem('last_name') || '',
                        email: localStorage.getItem('email') || '',
                        userId: userId,
                        fullName: `${localStorage.getItem('first_name') || ''} ${localStorage.getItem('last_name') || ''}`.trim()
                    }
                };
            }

            // Step 3: Send message to N8N with context
            const payload = {
                action: 'sendMessage',
                sessionId: sessionId,
                chatInput: inputMessage,
                userId: userId,
                userContext: userContext // Include user context for N8N
            };

            console.log('Sending to N8N with context:', payload);
            
            const res = await axios.post(
                'https://remmie.co:5678/webhook/3176c1ff-171f-4881-9c93-923ad256f38a/chat',
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Instance-Id': '2da9bf4f1ece7387f7a2c437b11f80fd9c2f46da08bd0e4f6f9aed86381a3f37'
                    }
                }
            );

            const botMsg = {
                sender: 'bot',
                text: res?.data?.output || '🤖 (no reply from bot)'
            };

            setMessages(prev => [...prev, botMsg]);
            
            // Step 4: Store BOT reply to backend
            await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/bookings-chat/store-message`, {
                sessionId: sessionId,
                message: botMsg.text,
                sender: 'bot',
                userId: userId
            });

        } catch (error) {
            const errorMsg = { sender: 'bot', text: '❌ Error contacting chatbot server.' };
            setMessages(prev => [...prev, errorMsg]);

            // Step 4: Also log error message to backend
            await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/bookings-chat/store-message`, {
                sessionId: sessionId,
                message: errorMsg.text,
                sender: 'bot',
                userId: userId
            });
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') sendMessage();
    };

    return (
        <div className='chatbox_main'>
            <span className='chat_toggle' onClick={toggleChat}>
                Live Chat <IconMessage />
            </span>

            <div className={`livechat_box ${isChatOpen ? 'active' : ''}`}>
                <div className='chat_header'>
                    <span className='btnchat_more'><IconDots /></span>
                    <h6>Live Chat</h6>
                    <span className='btnchat_close' onClick={closeChat}><IconMinus /></span>
                </div>

                <div className='livechat_body'>
                    <ul className='chat_list'>
                        {messages.map((msg, index) => (
                            <li key={index}>
                                <div className={msg.sender === 'user' ? 'user_msg' : 'admin_msg'}>
                                    {msg.sender === 'bot' ? (
                                        <ReactMarkdown
                                            children={msg.text}
                                            components={{
                                                p: ({ node, ...props }) => (
                                                    <p style={{ marginBottom: '6px' }} {...props} />
                                                )
                                            }}
                                        />
                                    ) : msg.text}
                                </div>
                            </li>
                        ))}
                        <div ref={messagesEndRef} />
                    </ul>

                    <div className='input-group'>
                        <Form.Control
                            placeholder='Type a Message'
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <button className='btn btn-primary btn-sm' onClick={sendMessage}>
                            <IconSend />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
