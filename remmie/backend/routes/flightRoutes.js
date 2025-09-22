//flightRoutes
const express = require('express');
const { placesSuggestions,offerRequests,offerRequestsMultidate,offers,fullOffers,createOrderLink,createConformOrder,saveOrderAmount,createRoundTripDeparture,createRoundTripReturn } = require('../controllers/flightController');
const router = express.Router();

router.post('/places-suggestions', placesSuggestions);
router.post('/offer-requests', offerRequests);
router.post('/offer-requests-multidate', offerRequestsMultidate);
router.post('/offers', offers);
router.post('/full-offers', fullOffers);
router.post('/create-order-link', createOrderLink);
router.post('/create-conform-order', createConformOrder);
router.post('/save-order-amount', saveOrderAmount);

// NEW ROUND-TRIP SPECIFIC ENDPOINTS
router.post('/round-trip/departure', createRoundTripDeparture);
router.post('/round-trip/return', createRoundTripReturn);


module.exports = router;
