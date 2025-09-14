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
        if (token) {
            try {
                
                const firstName = localStorage.getItem('first_name') || "";
                const lastName = localStorage.getItem('last_name')|| "";
                const welcomeMsg = {
                    sender: "bot",
                    text: `Hello ${firstName} ${lastName}! I'm Remmie, your travel booking assistant. I'm here to help you plan your perfect trip. How can I help you today, my friend?`
                };

                setMessages([welcomeMsg]);
            } catch (err) {
                console.error("JWT decode error:", err);
            }
        }
    }, []);

    const sendMessage = async () => {
        if (!inputMessage.trim()) return;

        const userMsg = { sender: 'user', text: inputMessage };
        setMessages(prev => [...prev, userMsg]);
        setInputMessage('');

        try {
            const payload = {
                action: 'sendMessage',
                sessionId: sessionId,
                chatInput: inputMessage,
                userId: userId // ✅ Send to bot
            };

            // Step 1: Store USER message to backend
            await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/bookings-chat/store-message`, {
                sessionId: sessionId,
                message: inputMessage,
                sender: 'user',
                userId: userId
            });

            // Step 2: Send message to N8N bot

            //https://remmie.co:5678/webhook/4e01d18e-de75-4e0c-80b8-bf9aae6e08f6/chat
            
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
