//flightRoutes
const express = require('express');
const { placesSuggestions,offerRequests,offerRequestsMultidate,offers,fullOffers,createOrderLink,createConformOrder,saveOrderAmount } = require('../controllers/flightController');
const router = express.Router();

router.post('/places-suggestions', placesSuggestions);
router.post('/offer-requests', offerRequests);
router.post('/offer-requests-multidate', offerRequestsMultidate);
router.post('/offers', offers);
router.post('/full-offers', fullOffers);
router.post('/create-order-link', createOrderLink);
router.post('/create-conform-order', createConformOrder);
router.post('/save-order-amount', saveOrderAmount);


module.exports = router;
