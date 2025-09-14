// Chatbox.jsx
import { IconDots, IconMessage, IconMinus, IconSend } from '@tabler/icons-react';
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Form } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import chatadminimg from "/src/assets/images/icon_sale.svg";
import { useChat } from '../context/ChatContext'; // ✅ Import context hook

export default function Chatbox() {
    const { isChatOpen, toggleChat, closeChat } = useChat(); // ✅ Use context state
    const [inputMessage, setInputMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [recipientId, setRecipientId] = useState(null);
    const [threadId, setThreadId] = useState(null);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!inputMessage.trim()) return;

        const userMsg = { sender: 'user', text: inputMessage };
        setMessages(prev => [...prev, userMsg]);
        setInputMessage('');

        try {
            const payload = {
                message: inputMessage,
                ...(recipientId && { recipient_id: recipientId }),
                ...(threadId && { thread_id: threadId })
            };

            const res = await axios.post(`https://remmie.co/chat`, payload);

            const botMsg = { sender: 'bot', text: res.data.response };
            setMessages(prev => [...prev, botMsg]);

            if (!recipientId) setRecipientId(res.data.recipient_id);
            if (!threadId) setThreadId(res.data.thread_id);

        } catch (error) {
            const errorMsg = { sender: 'bot', text: 'Error contacting server.' };
            setMessages(prev => [...prev, errorMsg]);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') sendMessage();
    };

    return (
        <div className='chatbox_main'>
            <span className='chat_toggle' onClick={toggleChat}>
                Expedia Live Chat <IconMessage />
            </span>

            <div className={`livechat_box ${isChatOpen ? 'active' : ''}`}>
                <div className='chat_header'>
                    <span className='btnchat_more'><IconDots /></span>
                    <h6>Expedia Live Chat</h6>
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
