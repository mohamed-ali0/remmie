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

    // useEffect(() => {
    //     scrollToBottom();
    // }, [messages]);
    useEffect(() => {
        if (token && userId) {
            loadChatHistory();
        }
    }, [token, userId]);

    const loadChatHistory = async () => {
        try {
            console.log('Loading chat history for user:', userId);
            
            // Try to load chat history from Python AI service
            const pythonApiUrl = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:5001';
            const response = await axios.get(`${pythonApiUrl}/chat-history/${userId}`);
            
            if (response.data && response.data.messages && response.data.messages.length > 0) {
                // Convert Python AI format to frontend format
                const formattedMessages = response.data.messages.map(msg => ({
                    sender: msg.role === 'user' ? 'user' : 'bot',
                    text: msg.content
                }));
                setMessages(formattedMessages);
                console.log('Loaded', formattedMessages.length, 'messages from history');
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

            // Step 2: Send message to Python AI service
            console.log('Sending message to Python AI:', inputMessage);
            
            const pythonApiUrl = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:5001';
            const res = await axios.post(
                `${pythonApiUrl}/chat`,
                {
                    message: inputMessage,
                    recipient_id: userId
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000 // 30 second timeout
                }
            );

            const botMsg = {
                sender: 'bot',
                text: res?.data?.response || '🤖 Sorry, I had trouble processing your request.'
            };

            setMessages(prev => [...prev, botMsg]);
            
            // Step 3: Store BOT reply to backend
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
