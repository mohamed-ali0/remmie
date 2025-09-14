//staysRoutes
const express = require('express');
const { accommodationSuggestions,staysSearch,staysQuotes,staysQuoteById,createOrderLink,saveStayAmount,createConformOrder } = require('../controllers/staysController');
const router = express.Router();

router.post('/accommodation-suggestions', accommodationSuggestions);
router.post('/stays-search', staysSearch);
router.post('/stays-quotes', staysQuotes);
router.post('/stays-quotes-by-id', staysQuoteById);

router.post('/create-order-link', createOrderLink);
router.post('/save-stay-amount', saveStayAmount);
router.post('/create-conform-order', createConformOrder);


//router.post('/bookings', bookings);

module.exports = router;
