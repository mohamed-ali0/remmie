import React from 'react';
import { ChatProvider } from './ChatContext';
const Providers = ({ children }) => {
    return (
        <ChatProvider>           
            {children} 
        </ChatProvider>
    );
};
export default Providers;