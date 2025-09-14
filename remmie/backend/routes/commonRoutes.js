// routes/commonRoutes.js
const express = require('express');
const { getBookingCommissionData} = require('../controllers/commonController');
const router = express.Router();

router.route('/get-booking-commission').get(getBookingCommissionData).post(getBookingCommissionData);



module.exports = router;
