// bookingsChatRoutes.js
const express = require('express');
const { storeMessage,findMessage,findUser,findUserMessage } = require('../controllers/bookingsChatController');
const router = express.Router();

router.post('/store-message', storeMessage);
router.post('/find-message', findMessage);
router.post('/find-user-message', findUserMessage);

router.post('/find-user', findUser);

module.exports = router;
