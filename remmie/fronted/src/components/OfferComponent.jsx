import React, { useEffect, useState } from 'react';

const OfferComponent = ({ expiresAt, onExpiryChange }) => {
  const [isExpired, setIsExpired] = useState(false);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!expiresAt) return;

    const expiryTime = new Date(expiresAt).getTime();

    const updateCountdown = () => {
      const now = Date.now();
      const diff = expiryTime - now;
      
      if (diff <= 0) {
        setIsExpired(true);
        if (onExpiryChange) onExpiryChange(true);
        setCountdown('Offer expired');
        clearInterval(interval);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
    };

    updateCountdown(); // Initial call

    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpiryChange]);

  // Background checker (in case user waits without clicking)
  useEffect(() => {
    if (!expiresAt) return;

    const expiryTime = new Date(expiresAt).getTime();

    const checkExpiry = () => {
      if (Date.now() > expiryTime) {
        setIsExpired(true);
        if (onExpiryChange) onExpiryChange(true);
      }
    };

    const bgInterval = setInterval(checkExpiry, 5000); // Check every 5s

    return () => clearInterval(bgInterval);
  }, [expiresAt, onExpiryChange]);

  return (
    <div className="p-4 gray-300 bg-white max-w-md mx-auto mt-6 text-end">    
      <p className="text-sm text-gray-700">
        ⏳ Offer expires in: <strong className="text-red-600">{countdown}</strong>
      </p>

      {isExpired && (
        <p className="text-red-700 mt-2">⚠️ This offer has expired.</p>
      )}
    </div>
  );
};

export default OfferComponent;