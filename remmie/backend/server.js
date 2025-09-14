// server.js
// require('dotenv').config();
// const express = require('express');
// const cors    = require('cors');

// const authRoutes   = require('./routes/authRoutes');
// const bookingRoutes= require('./routes/bookingRoutes');
// const stripeRoutes = require('./routes/stripeRoutes');
// const whatsAppRoutes = require('./routes/whatsAppRoutes');

// const app = express();
// app.use(cors());
// app.use(express.json());

// // Public auth routes
// app.use('/api/auth', authRoutes);

// // Protected booking routes
// app.use('/api/booking', bookingRoutes);

// // Protected Stripe session route
// app.use('/api/stripe', stripeRoutes);

// // WhatsApp webhook route
// app.use('/api/whatsapp', whatsAppRoutes); // Add WhatsApp webhook endpoint

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



require('dotenv').config();
const fs = require('fs');
const https = require('https');
const express = require('express');
const cors = require('cors');

const authRoutes      = require('./routes/authRoutes');
const bookingRoutes   = require('./routes/bookingRoutes');
const stripeRoutes    = require('./routes/stripeRoutes');
const whatsAppRoutes  = require('./routes/whatsAppRoutes');
const commonRoutes  = require('./routes/commonRoutes');
const flightRoutes  = require('./routes/flightRoutes');
const bookingsChatRoutes  = require('./routes/bookingsChatRoutes');
const staysRoutes  = require('./routes/staysRoutes');


const app = express();
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/whatsapp', whatsAppRoutes);
app.use('/api/common', commonRoutes);
app.use('/api/flight', flightRoutes);
app.use('/api/bookings-chat', bookingsChatRoutes);
app.use('/api/stays', staysRoutes);

const PORT = process.env.PORT || 5000;

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'remmie-backend'
    });
});

// SSL Configuration - only use HTTPS if certificates are available
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;

if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    // HTTPS server for production
    const options = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath)
    };
    
    https.createServer(options, app).listen(PORT, () => {
        console.log(`✅ HTTPS server running on https://localhost:${PORT}`);
    });
} else {
    // HTTP server for development/Docker
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ HTTP server running on http://localhost:${PORT}`);
        if (process.env.NODE_ENV === 'production') {
            console.log('⚠️  Running in HTTP mode. For production, configure SSL certificates.');
        }
    });
}
