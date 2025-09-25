// routes/stripeRoutes.js
const express = require('express');
const { createFlightPaymentSession,
		saveCardAfterSuccess,
		confirmPayment,
		createStayPaymentSession,
		confirmStayPayment,
		userPaymentMethodsList,
		userPaymentMethodsAdd,
		userPaymentMethodsSetDefault,
		userPaymentMethodsDelete,
		PaymentTest
	} = require('../controllers/stripeController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/stripe/create-checkout-session
router.post('/create-flight-payment-session', authenticate, createFlightPaymentSession);
router.post('/save-card-after-success', authenticate, saveCardAfterSuccess);
router.post('/confirm-payment', authenticate, confirmPayment);

router.post('/create-stay-payment-session', authenticate, createStayPaymentSession);
router.post('/confirm-stay-Payment', authenticate, confirmStayPayment);
router.post('/user-payment-methods-list', authenticate, userPaymentMethodsList);
router.post('/user-payment-methods-setdefault', authenticate, userPaymentMethodsSetDefault);
router.post('/user-payment-methods-add', authenticate, userPaymentMethodsAdd);
router.post('/user-payment-methods-delete', authenticate, userPaymentMethodsDelete);
router.post('/payment-test',PaymentTest);

module.exports = router;
