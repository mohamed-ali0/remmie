import React, { createContext, useContext, useState } from 'react';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const toggleChat = () => setIsChatOpen(prev => !prev);
    const closeChat = () => setIsChatOpen(false);

    return (
        <ChatContext.Provider value={{ isChatOpen, toggleChat, closeChat }}>
            {children}
        </ChatContext.Provider>
    );
};
