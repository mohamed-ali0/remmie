// routes/bookingRoutes.js
const express = require('express');
const { getBookingByRef,
		getBookingData,
		getUserBookingList,
		getUserSingleBooking,
		getUserStaysBookingList,
		getUserStaysSingleBooking 
	  } = require('../controllers/bookingController');
const { authenticate }    = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/get-booking-Data', getBookingData);
router.post('/get-booking-byref', authenticate, getBookingByRef);
router.post('/get-user-booking-list', authenticate, getUserBookingList);
router.post('/get-user-single-booking', authenticate, getUserSingleBooking);


router.post('/get-user-stays-booking-list', authenticate, getUserStaysBookingList);
router.post('/get-user-Stays-single-booking', authenticate, getUserStaysSingleBooking);


module.exports = router;
