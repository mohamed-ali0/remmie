const express = require('express');
const { wpWebhook } = require('../controllers/whatsAppController');
const router = express.Router();

// Handle both GET and POST requests for the webhook

//router.post('/webhook', wpWebhook); // Correctly reference the webhook function

//router.get('/webhook', wpWebhook);
router.route('/webhook').get(wpWebhook).post(wpWebhook);

// router.route('/webhook')
//     .get(wpWebhook)  // For WhatsApp webhook verification
//     .post(wpWebhook); // For incoming WhatsApp messages

module.exports = router;