// controllers/stripeController.js
const Stripe = require('stripe');
const { pool, dbPrefix } = require('../config/db');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const frontendBase = process.env.FRONTEND_URL;
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; 


async function createFlightPaymentSession(req, res) {
  const { booking_ref,passengers,contact } = req.body;
  const userId = req.user.userId;
  try {

    const guestDetails = {
      contact: contact,        // contact object
      passengers: passengers   // passengers array
    };
    await pool.query(
        `UPDATE ${dbPrefix}bookings 
         SET guest_details = ?
         WHERE booking_reference = ?  AND user_id = ?`,
        [
          JSON.stringify(guestDetails),
          booking_ref,
          userId
        ]
      );

    // 1. Load booking details - handle round-trip
    const [[booking]] = await pool.query(
      `SELECT amount, currency, round_trip_session_id, round_trip_type 
         FROM ${dbPrefix}bookings 
        WHERE booking_reference = ? AND user_id = ? 
        LIMIT 1`,
      [booking_ref, userId]
    );

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    let totalAmount = booking.amount;
    let currency = booking.currency;
    
    // For round-trip, calculate total amount from both bookings
    if (booking.round_trip_session_id) {
      console.log(`🔄 Round-trip payment detected: ${booking.round_trip_session_id}`);
      
      const [sessionBookings] = await pool.query(
        `SELECT amount, currency FROM ${dbPrefix}bookings 
         WHERE round_trip_session_id = ? AND user_id = ?`,
        [booking.round_trip_session_id, userId]
      );
      
      if (sessionBookings.length === 2) {
        // Check if any booking has null amount (happens when saveOrderAmount wasn't called for return booking)
        const hasNullAmount = sessionBookings.some(b => b.amount === null || b.amount === undefined);
        
        if (hasNullAmount) {
          console.log(`⚠️ Some bookings have null amounts, using combined total from departure booking`);
          // Use the amount from the departure booking (which should contain the total)
          const departureBooking = sessionBookings.find(b => parseFloat(b.amount) > 0);
          if (departureBooking) {
            totalAmount = parseFloat(departureBooking.amount);
            console.log(`   Using departure booking amount as total: $${totalAmount}`);
          }
        } else {
          totalAmount = sessionBookings.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
          console.log(`   Departure + Return: ${sessionBookings.map(b => `$${b.amount || 0}`).join(' + ')} = $${totalAmount}`);
        }
      }
    }

    // Safety check for NaN
    if (isNaN(totalAmount) || totalAmount <= 0) {
      console.error(`❌ Invalid total amount: ${totalAmount}`);
      return res.status(400).json({ 
        message: 'Invalid payment amount. Please contact support.',
        error: 'INVALID_AMOUNT',
        totalAmount: totalAmount
      });
    }
    
    const unitAmount = Math.round(totalAmount * 100);
    
    console.log(`💳 Creating flight payment session:`);
    console.log(`   Booking ref: ${booking_ref}`);
    console.log(`   Is round-trip: ${!!booking.round_trip_session_id}`);
    console.log(`   Total amount: ${totalAmount}`);
    console.log(`   Currency: ${currency}`);
    console.log(`   Stripe unit amount: ${unitAmount} (amount * 100)`);

    // 2. Get Stripe customer ID
    const [[user]] = await pool.query(
      `SELECT u.email, p.stripe_customer_id, p.payment_method_id
         FROM ${dbPrefix}users u
    LEFT JOIN ${dbPrefix}user_payment_methods p ON u.id = p.user_id
        WHERE u.id = ?
        ORDER BY p.id DESC
        LIMIT 1`,
      [userId]
    );

    if (!user || !user.email) {
      return res.status(400).json({ message: 'User not found or missing email' });
    }

    let stripeCustomerId = user.stripe_customer_id;
    let paymentMethodId = user.payment_method_id;  // Retrieve the saved payment method ID

    // 3. Create customer if not exists
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: userId }
      });
    
      stripeCustomerId = customer.id;
    
      // Check if same customer ID already exists
      const [[existing]] = await pool.query(
        `SELECT id FROM ${dbPrefix}user_payment_methods 
         WHERE user_id = ? AND stripe_customer_id = ? 
         LIMIT 1`,
        [userId, stripeCustomerId]
      );
    
      // Only insert if not exists
      if (!existing) {
        await pool.query(
          `INSERT INTO ${dbPrefix}user_payment_methods 
           (user_id, stripe_customer_id, created_at)
           VALUES (?, ?, NOW())`,
          [userId, stripeCustomerId]
        );
      }
    }

    // 4. Check saved payment method
    if (paymentMethodId) {
      // Direct charge using saved card
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      const defaultPm = customer.invoice_settings.default_payment_method;

       // If DB method is not default, prefer Stripe's default
      const methodToUse = defaultPm || paymentMethodId;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: unitAmount,
        currency: booking.currency.toLowerCase(),
        customer: stripeCustomerId,
        payment_method: methodToUse,  // Use the saved payment method ID
        off_session: true,
        confirm: true,  // Confirm payment directly
        metadata: {
          booking_ref,
          user_id: userId
        }
      });

      return res.json({
        status: 'redirect',
        url: `${frontendBase}/booking-success?booking_ref=${booking_ref}&session_id=${paymentIntent.id}`
      });
      
    } else {
      // ❌ No saved card → create checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer: stripeCustomerId,
        payment_intent_data: {
          setup_future_usage: 'off_session'
        },
        line_items: [{
          price_data: {
            currency: booking.currency.toLowerCase(),
            product_data: {
              name: `Flight Booking (${booking_ref})`
            },
            unit_amount: unitAmount
          },
          quantity: 1
        }],
        metadata: {
          booking_ref,
          user_id: userId
        },
        success_url: `${frontendBase}/booking-success?booking_ref=${booking_ref}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendBase}/bookingcart?booking_ref=${booking_ref}`
      });

      return res.json({
        status: 'redirect',
        url: session.url,
        message: 'Redirecting to Stripe Checkout to add a new card'
      });
    }

  } catch (err) {
    console.error('Stripe Payment Error:', err);
    return res.status(500).json({ message: 'Payment process failed' });
  }
}

// async function saveCardAfterSuccess(req, res) {
//   const { session_id } = req.body;
//   const userId = req.user.userId;

//   try {
//     const session = await stripe.checkout.sessions.retrieve(session_id);
//     const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);

//     const paymentMethodId = paymentIntent.payment_method;
//     const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

//     // console.log("Stripe Customer ID:", session.customer);
//     // console.log("User ID:", userId);

//     res.json({ success: true, message: 'Card saved',"Stripe Customer ID:": session.customer,"User ID:": userId });
    
//     // Insert into DB
//     await pool.query(
//       `INSERT INTO ${dbPrefix}user_payment_methods 
//         (user_id, stripe_customer_id, payment_method_id, card_brand, card_last4, exp_month, exp_year, created_at)
//        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
//       [
//         userId,
//         paymentIntent.customer,
//         paymentMethod.id,
//         paymentMethod.card.brand,
//         paymentMethod.card.last4,
//         paymentMethod.card.exp_month,
//         paymentMethod.card.exp_year
//       ]
//     );

//     res.json({ success: true, message: 'Card saved' });
//   } catch (err) {
//     console.error('Save card error:', err);
//     res.status(500).json({ success: false, message: 'Failed to save card' });
//   }
// }

async function confirmPayment(req, res) {
  const { session_id, booking_ref } = req.body;
  const userId = req.user.userId;

  if (!session_id || !booking_ref) {
    return res.status(400).json({ success: false, message: 'session_id and booking_ref are required' });
  }

  try {
    let paymentStatus = '';
    let paymentIntentId = '';
    let metadata = {};
    let rawStripeData;

    if (session_id.startsWith('cs_')) {
      // This is a Stripe Checkout session
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ success: false, message: 'Checkout session not paid' });
      }

      metadata = session.metadata || {};
      paymentIntentId = session.payment_intent;
      paymentStatus = session.payment_status;
      rawStripeData = session;

    } else if (session_id.startsWith('pi_')) {
      // This is a direct PaymentIntent (off-session payment)
      const paymentIntent = await stripe.paymentIntents.retrieve(session_id);
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ success: false, message: 'PaymentIntent not succeeded' });
      }

      metadata = paymentIntent.metadata || {};
      paymentIntentId = paymentIntent.id;
      paymentStatus = paymentIntent.status;
      rawStripeData = paymentIntent;

    } else {
      return res.status(400).json({ success: false, message: 'Invalid session_id format' });
    }

    // Metadata checks (same for both)
    if (
      metadata.booking_ref !== booking_ref ||
      metadata.user_id !== String(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Metadata mismatch'
      });
    }

    // Save to database
    const payJson = JSON.stringify(rawStripeData);
    await pool.query(
      `UPDATE ${dbPrefix}bookings
         SET payment_status = ?,
             payment_intent = ?,
             pay_json = ?
       WHERE booking_reference = ?
         AND user_id = ?
       LIMIT 1`,
      [paymentStatus, paymentIntentId, payJson, booking_ref, userId]
    );

    const [[existing]] = await pool.query(
      `SELECT id,booking_json,guest_details FROM ${dbPrefix}bookings 
       WHERE booking_reference = ?
         AND user_id = ?
       LIMIT 1`,
      [booking_ref, userId]
    );

    if(existing){
      return res.json({
        success: true,
        booking_ref,
        payment_intent: paymentIntentId,
        id: existing.id,
        booking_json: existing.booking_json,
        guest_details: existing.guest_details
      });  
    }

    

  } catch (err) {
    console.error('confirmPayment error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}


async function confirmStayPayment(req, res) {
  const { session_id, booking_ref } = req.body;
  const userId = req.user.userId;

  if (!session_id || !booking_ref) {
    return res.status(400).json({ success: false, message: 'session_id and booking_ref are required' });
  }

  try {
    let paymentStatus = '';
    let paymentIntentId = '';
    let metadata = {};
    let rawStripeData;

    if (session_id.startsWith('cs_')) {
      // This is a Stripe Checkout session
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ success: false, message: 'Checkout session not paid' });
      }

      metadata = session.metadata || {};
      paymentIntentId = session.payment_intent;
      paymentStatus = session.payment_status;
      rawStripeData = session;

    } else if (session_id.startsWith('pi_')) {
      // This is a direct PaymentIntent (off-session payment)
      const paymentIntent = await stripe.paymentIntents.retrieve(session_id);
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ success: false, message: 'PaymentIntent not succeeded' });
      }

      metadata = paymentIntent.metadata || {};
      paymentIntentId = paymentIntent.id;
      paymentStatus = paymentIntent.status;
      rawStripeData = paymentIntent;

    } else {
      return res.status(400).json({ success: false, message: 'Invalid session_id format' });
    }

    // Metadata checks (same for both)
    if (
      metadata.booking_ref !== booking_ref ||
      metadata.user_id !== String(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Metadata mismatch'
      });
    }

    // Save to database
    const payJson = JSON.stringify(rawStripeData);
    await pool.query(
      `UPDATE ${dbPrefix}bookings
         SET payment_status = ?,
             payment_intent = ?,
             pay_json = ?
       WHERE booking_reference = ?
         AND user_id = ?
       LIMIT 1`,
      [paymentStatus, paymentIntentId, payJson, booking_ref, userId]
    );

    const [[existing]] = await pool.query(
      `SELECT id,booking_json,guest_details FROM ${dbPrefix}bookings 
       WHERE booking_reference = ?
         AND user_id = ?
       LIMIT 1`,
      [booking_ref, userId]
    );

    if(existing){
      return res.json({
        success: true,
        booking_ref,
        payment_intent: paymentIntentId,
        id: existing.id,
        booking_json: existing.booking_json,
        guest_details: existing.guest_details
      });  
    }

    

  } catch (err) {
    console.error('confirmPayment error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
async function createStayPaymentSession(req, res) {
  const { booking_ref,guest_details } = req.body;
  const userId = req.user.userId;

  try {

    await pool.query(
        `UPDATE ${dbPrefix}bookings 
         SET guest_details = ?
         WHERE booking_reference = ?`,
        [
          JSON.stringify(guest_details),
          booking_ref
        ]
      );
    // 1. Load booking details
    const [[booking]] = await pool.query(
      `SELECT amount, currency 
         FROM ${dbPrefix}bookings 
        WHERE booking_reference = ? AND user_id = ? 
        LIMIT 1`,
      [booking_ref, userId]
    );

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const unitAmount = Math.round(booking.amount * 100);

    // 2. Get Stripe customer ID
    const [[user]] = await pool.query(
      `SELECT u.email, p.stripe_customer_id, p.payment_method_id
         FROM ${dbPrefix}users u
    LEFT JOIN ${dbPrefix}user_payment_methods p ON u.id = p.user_id
        WHERE u.id = ?
        ORDER BY p.id DESC
        LIMIT 1`,
      [userId]
    );

    if (!user || !user.email) {
      return res.status(400).json({ message: 'User not found or missing email' });
    }

    let stripeCustomerId = user.stripe_customer_id;
    let paymentMethodId = user.payment_method_id;  // Retrieve the saved payment method ID

    // 3. Create customer if not exists
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: userId }
      });
    
      stripeCustomerId = customer.id;
    
      // Check if same customer ID already exists
      const [[existing]] = await pool.query(
        `SELECT id FROM ${dbPrefix}user_payment_methods 
         WHERE user_id = ? AND stripe_customer_id = ? 
         LIMIT 1`,
        [userId, stripeCustomerId]
      );
    
      // Only insert if not exists
      if (!existing) {
        await pool.query(
          `INSERT INTO ${dbPrefix}user_payment_methods 
           (user_id, stripe_customer_id, created_at)
           VALUES (?, ?, NOW())`,
          [userId, stripeCustomerId]
        );
      }
    }

    // 4. Check saved payment method
    if (paymentMethodId) {
      // Direct charge using saved card
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      const defaultPm = customer.invoice_settings.default_payment_method;

       // If DB method is not default, prefer Stripe's default
      const methodToUse = defaultPm || paymentMethodId;

      // Direct charge using saved card
      const paymentIntent = await stripe.paymentIntents.create({
        amount: unitAmount,
        currency: booking.currency.toLowerCase(),
        customer: stripeCustomerId,
        payment_method: methodToUse,  // Use the saved payment method ID
        off_session: true,
        confirm: true,  // Confirm payment directly
        metadata: {
          booking_ref,
          user_id: userId
        }
      });

      return res.json({
        status: 'redirect',
        url: `${frontendBase}/stay-booking-success?booking_ref=${booking_ref}&session_id=${paymentIntent.id}`
      });
      
    } else {
      // No saved card → create checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer: stripeCustomerId,
        payment_intent_data: {
          setup_future_usage: 'off_session'
        },
        line_items: [{
          price_data: {
            currency: booking.currency.toLowerCase(),
            product_data: {
              name: `Stay Booking (${booking_ref})`
            },
            unit_amount: unitAmount
          },
          quantity: 1
        }],
        metadata: {
          booking_ref,
          user_id: userId
        },
        success_url: `${frontendBase}/stay-booking-success?booking_ref=${booking_ref}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendBase}/staycart?booking_ref=${booking_ref}`
      });

      return res.json({
        status: 'redirect',
        url: session.url,
        message: 'Redirecting to Stripe Checkout to add a new card'
      });
    }

  } catch (err) {
    console.error('Stripe Payment Error:', err);
    return res.status(500).json({ message: 'Payment process failed' });
  }
}
async function saveCardAfterSuccess(req, res) {
  const { session_id } = req.body;
  const userId = req.user.userId;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);

    const paymentMethodId = paymentIntent.payment_method;
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    const stripeCustomerId = session.customer;

    // Check if record already exists for this user and customer
    const [[existing]] = await pool.query(
      `SELECT id FROM ${dbPrefix}user_payment_methods 
       WHERE user_id = ? AND stripe_customer_id = ?
       LIMIT 1`,
      [userId, stripeCustomerId]
    );

    if (existing) {
      // Update existing record
      await pool.query(
        `UPDATE ${dbPrefix}user_payment_methods 
         SET payment_method_id = ?, card_brand = ?, card_last4 = ?, 
             exp_month = ?, exp_year = ?, updated_at = NOW() 
         WHERE id = ?`,
        [
          paymentMethod.id,
          paymentMethod.card.brand,
          paymentMethod.card.last4,
          paymentMethod.card.exp_month,
          paymentMethod.card.exp_year,
          existing.id
        ]
      );
    } else {
      // Insert new record
      await pool.query(
        `INSERT INTO ${dbPrefix}user_payment_methods 
          (user_id, stripe_customer_id, payment_method_id, card_brand, card_last4, exp_month, exp_year, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          stripeCustomerId,
          paymentMethod.id,
          paymentMethod.card.brand,
          paymentMethod.card.last4,
          paymentMethod.card.exp_month,
          paymentMethod.card.exp_year
        ]
      );
    }

    res.json({ success: true, message: 'Card saved successfully' });

  } catch (err) {
    console.error('Save card error:', err);
    res.status(500).json({ success: false, message: 'Failed to save card' });
  }
}


// async function userPaymentMethodsList(req, res) {
//   const userId = req.user.userId;

//   try {
//     const [[user]] = await pool.query(
//       `SELECT stripe_customer_id, payment_method_id 
//          FROM ${dbPrefix}user_payment_methods 
//         WHERE user_id = ? 
//         LIMIT 1`,
//       [userId]
//     );

//     if (!user || !user.stripe_customer_id) {
//       return res.json({ success: true, cards: [] });
//     }

//     const paymentMethods = await stripe.paymentMethods.list({
//       customer: user.stripe_customer_id,
//       type: 'card',
//     });

//     const cards = paymentMethods.data.map(pm => ({
//       id: pm.id,
//       brand: pm.card.brand,
//       last4: pm.card.last4,
//       exp_month: pm.card.exp_month,
//       exp_year: pm.card.exp_year,
//       is_default: pm.id === user.payment_method_id // DBમાં save થયેલું default card
//     }));

//     return res.json({ success: true, cards });

//   } catch (err) {
//     console.error('List cards error:', err);
//     return res.status(500).json({ success: false, message: 'Failed to fetch cards' });
//   }
// }

async function userPaymentMethodsList(req, res) {
  const userId = req.user.userId;

  try {
    // DB માંથી customer_id લાવો
    const [[user]] = await pool.query(
      `SELECT stripe_customer_id 
         FROM ${dbPrefix}user_payment_methods 
        WHERE user_id = ? 
        LIMIT 1`,
      [userId]
    );

    if (!user || !user.stripe_customer_id) {
      return res.json({ success: true, cards: [] });
    }

    // 1️⃣ Stripe customer fetch કરો (default_payment_method અહીં મળશે)
    const customer = await stripe.customers.retrieve(user.stripe_customer_id);
    const defaultPm = customer.invoice_settings.default_payment_method;

    // 2️⃣ Customerના બધા payment methods લાવો
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripe_customer_id,
      type: 'card',
    });

    // 3️⃣ દરેક card return કરો + default flag Stripe પરથી
    const cards = paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
      is_default: pm.id === defaultPm   // હવે Stripeનું સાચું default
    }));

    return res.json({ success: true, cards });

  } catch (err) {
    console.error('List cards error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch cards' });
  }
}

// ----------------------------
// Add new card
// ----------------------------
// async function userPaymentMethodAdd(req, res) {
//   const { payment_method_id } = req.body;
//   const userId = req.user.userId;

//   try {
//     // 1. Get customer id
//     const [[user]] = await pool.query(
//       `SELECT stripe_customer_id FROM ${dbPrefix}user_payment_methods 
//        WHERE user_id = ? LIMIT 1`,
//       [userId]
//     );

//     if (!user || !user.stripe_customer_id) {
//       return res.status(400).json({ success: false, message: 'Stripe customer not found' });
//     }

//     // 2. Attach payment method to customer
//     await stripe.paymentMethods.attach(payment_method_id, {
//       customer: user.stripe_customer_id,
//     });

//     // 3. Retrieve payment method details
//     const pm = await stripe.paymentMethods.retrieve(payment_method_id);

//     // 4. Update DB (set as default if no card set yet)
//     await pool.query(
//       `UPDATE ${dbPrefix}user_payment_methods
//          SET payment_method_id = ?, card_brand = ?, card_last4 = ?, exp_month = ?, exp_year = ?, updated_at = NOW()
//        WHERE user_id = ?`,
//       [pm.id, pm.card.brand, pm.card.last4, pm.card.exp_month, pm.card.exp_year, userId]
//     );

//     return res.json({ success: true, message: 'Card added successfully' });
//   } catch (err) {
//     console.error('Add card error:', err);
//     return res.status(500).json({ success: false, message: 'Failed to add card' });
//   }
// }

async function userPaymentMethodsAdd(req, res) {
  const { payment_method_id } = req.body;
  const userId = req.user.userId;

  try {
    // 1. Get any existing stripe_customer_id for this user
    const [[existing]] = await pool.query(
      `SELECT stripe_customer_id 
         FROM ${dbPrefix}user_payment_methods 
        WHERE user_id = ? 
        LIMIT 1`,
      [userId]
    );

    let customerId = existing ? existing.stripe_customer_id : null;

    // 2. If no customer, create new one
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { userId: userId },
      });
      customerId = customer.id;
    }

    // 3. Attach payment method to Stripe customer
    await stripe.paymentMethods.attach(payment_method_id, {
      customer: customerId,
    });

    // 4. Get card details
    const pm = await stripe.paymentMethods.retrieve(payment_method_id);

    // 5. Save new card in DB (new row per card)
    await pool.query(
      `INSERT INTO ${dbPrefix}user_payment_methods 
         (user_id, stripe_customer_id, payment_method_id, card_brand, card_last4, exp_month, exp_year, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, customerId, pm.id, pm.card.brand, pm.card.last4, pm.card.exp_month, pm.card.exp_year]
    );

    return res.json({
      success: true,
      message: 'Card added successfully',
      customer_id: customerId,
    });
  } catch (err) {
    console.error('Add card error:', err);
    return res.status(500).json({ success: false, message: 'Failed to add card' });
  }
}


// ----------------------------
// Update default card
// ----------------------------
async function userPaymentMethodsSetDefault(req, res) {
  const { card_id } = req.body;
  const userId = req.user.userId;

  try {
    // 1. Get stripe customer
    const [[user]] = await pool.query(
      `SELECT stripe_customer_id FROM ${dbPrefix}user_payment_methods 
       WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // 2. Update Stripe customer default payment method
    await stripe.customers.update(user.stripe_customer_id, {
      invoice_settings: { default_payment_method: card_id },
    });

    // 3. Update DB
    await pool.query(
      `UPDATE ${dbPrefix}user_payment_methods
         SET updated_at = NOW()
       WHERE user_id = ? AND payment_method_id = ?`,
      [userId,card_id]
    );

    return res.json({ success: true, message: 'Default card updated' });
  } catch (err) {
    console.error('Update card error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update card' });
  }
}

// ----------------------------
// Delete card
// ----------------------------
async function userPaymentMethodsDelete(req, res) {
  const { card_id } = req.body;
  const userId = req.user.userId;

  try {
    // 1. Get stripe customer
    const [[user]] = await pool.query(
      `SELECT stripe_customer_id FROM ${dbPrefix}user_payment_methods 
       WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // 2. Detach card from stripe
    await stripe.paymentMethods.detach(card_id);

    // 3. If deleted card was default, nullify DB default
    // await pool.query(
    //   `UPDATE ${dbPrefix}user_payment_methods
    //      SET payment_method_id = NULL, updated_at = NOW()
    //    WHERE user_id = ? AND payment_method_id = ?`,
    //   [userId, card_id]
    // );

    await pool.query(
      `DELETE FROM ${dbPrefix}user_payment_methods
       WHERE user_id = ? AND payment_method_id = ?`,
      [userId, card_id]
    );
    
    return res.json({ success: true, message: 'Card deleted successfully' });
  } catch (err) {
    console.error('Delete card error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete card' });
  }
}

async function PaymentTest(req, res) {
      const customer = await stripe.customers.retrieve('cus_StwWQ9NRwGd8s3');
      const defaultPm = customer.invoice_settings.default_payment_method;
      return res.json({ success: true, message: customer,message2: defaultPm });

  }

// Test endpoints for complete booking flow simulation
async function testOneWayBooking(req, res) {
  try {
    const userId = req.user.userId;
    
    // Mock flight data (one-way)
    const mockFlightData = {
      quote_id: `quote_${Date.now()}`,
      passengers: [
        {
          id: "passenger_1",
          type: "adult",
          title: "Mr",
          given_name: "John",
          family_name: "Doe",
          born_on: "1990-01-15",
          phone_number: "+1234567890",
          email: "john.doe@example.com",
          gender: "m"
        }
      ],
      slices: [
        {
          origin: {
            iata_code: "LAX",
            name: "Los Angeles International Airport"
          },
          destination: {
            iata_code: "JFK", 
            name: "John F. Kennedy International Airport"
          },
          departure_date: "2025-02-15",
          arrival_date: "2025-02-15",
          segments: [
            {
              origin: {
                iata_code: "LAX",
                name: "Los Angeles International Airport"
              },
              destination: {
                iata_code: "JFK",
                name: "John F. Kennedy International Airport"
              },
              departing_at: "2025-02-15T08:00:00",
              arriving_at: "2025-02-15T16:30:00",
              duration: "PT8H30M",
              operating_carrier: {
                iata_code: "AA",
                name: "American Airlines",
                logo_symbol_url: "https://example.com/aa-logo.png"
              },
              operating_carrier_flight_number: "1234",
              aircraft: {
                name: "Boeing 737"
              },
              distance: 2475,
              passengers: [
                {
                  cabin_class_marketing_name: "Economy",
                  baggages: [
                    {
                      quantity: 1,
                      type: "carry_on"
                    },
                    {
                      quantity: 1,
                      type: "checked_bag"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ],
      base_amount: 450.00,
      tax_amount: 89.50,
      total_amount: 539.50,
      currency: "USD",
      booking_reference: `TEST_OW_${Date.now()}`
    };

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'One-Way Flight Booking Test',
              description: `LAX to JFK - ${mockFlightData.passengers[0].given_name} ${mockFlightData.passengers[0].family_name}`,
            },
            unit_amount: Math.round(mockFlightData.total_amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendBase}/booking-success?booking_ref=${mockFlightData.booking_reference}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBase}/flight`,
      metadata: {
        booking_ref: mockFlightData.booking_reference,
        user_id: userId.toString(),
        test_type: 'one_way'
      }
    });

    res.json({
      success: true,
      message: 'Test one-way booking created successfully',
      booking_reference: mockFlightData.booking_reference,
      payment_url: session.url,
      mock_data: mockFlightData
    });

  } catch (error) {
    console.error('Test one-way booking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create test one-way booking',
      error: error.message 
    });
  }
}

async function testRoundTripBooking(req, res) {
  try {
    const userId = req.user.userId;
    
    // Mock flight data (round-trip)
    const mockFlightData = {
      quote_id: `quote_${Date.now()}`,
      passengers: [
        {
          id: "passenger_1",
          type: "adult",
          title: "Ms",
          given_name: "Jane",
          family_name: "Smith",
          born_on: "1985-05-20",
          phone_number: "+1987654321",
          email: "jane.smith@example.com",
          gender: "f"
        }
      ],
      slices: [
        {
          origin: {
            iata_code: "NYC",
            name: "New York City"
          },
          destination: {
            iata_code: "LAX",
            name: "Los Angeles International Airport"
          },
          departure_date: "2025-03-10",
          arrival_date: "2025-03-10",
          segments: [
            {
              origin: {
                iata_code: "JFK",
                name: "John F. Kennedy International Airport"
              },
              destination: {
                iata_code: "LAX",
                name: "Los Angeles International Airport"
              },
              departing_at: "2025-03-10T10:30:00",
              arriving_at: "2025-03-10T13:45:00",
              duration: "PT6H15M",
              operating_carrier: {
                iata_code: "DL",
                name: "Delta Air Lines",
                logo_symbol_url: "https://example.com/delta-logo.png"
              },
              operating_carrier_flight_number: "5678",
              aircraft: {
                name: "Airbus A320"
              },
              distance: 2475,
              passengers: [
                {
                  cabin_class_marketing_name: "Economy",
                  baggages: [
                    {
                      quantity: 1,
                      type: "carry_on"
                    },
                    {
                      quantity: 2,
                      type: "checked_bag"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          origin: {
            iata_code: "LAX",
            name: "Los Angeles International Airport"
          },
          destination: {
            iata_code: "NYC",
            name: "New York City"
          },
          departure_date: "2025-03-17",
          arrival_date: "2025-03-17",
          segments: [
            {
              origin: {
                iata_code: "LAX",
                name: "Los Angeles International Airport"
              },
              destination: {
                iata_code: "JFK",
                name: "John F. Kennedy International Airport"
              },
              departing_at: "2025-03-17T14:20:00",
              arriving_at: "2025-03-17T22:35:00",
              duration: "PT5H15M",
              operating_carrier: {
                iata_code: "UA",
                name: "United Airlines",
                logo_symbol_url: "https://example.com/united-logo.png"
              },
              operating_carrier_flight_number: "9012",
              aircraft: {
                name: "Boeing 787"
              },
              distance: 2475,
              passengers: [
                {
                  cabin_class_marketing_name: "Economy",
                  baggages: [
                    {
                      quantity: 1,
                      type: "carry_on"
                    },
                    {
                      quantity: 2,
                      type: "checked_bag"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ],
      base_amount: 720.00,
      tax_amount: 145.80,
      total_amount: 865.80,
      currency: "USD",
      booking_reference: `TEST_RT_${Date.now()}`,
      is_round_trip: true
    };

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Round-Trip Flight Booking Test',
              description: `JFK ↔ LAX - ${mockFlightData.passengers[0].given_name} ${mockFlightData.passengers[0].family_name}`,
            },
            unit_amount: Math.round(mockFlightData.total_amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendBase}/booking-success?booking_ref=${mockFlightData.booking_reference}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBase}/flight`,
      metadata: {
        booking_ref: mockFlightData.booking_reference,
        user_id: userId.toString(),
        test_type: 'round_trip'
      }
    });

    res.json({
      success: true,
      message: 'Test round-trip booking created successfully',
      booking_reference: mockFlightData.booking_reference,
      payment_url: session.url,
      mock_data: mockFlightData
    });

  } catch (error) {
    console.error('Test round-trip booking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create test round-trip booking',
      error: error.message 
    });
  }
}

module.exports = {
  createFlightPaymentSession, 
  confirmPayment, 
  saveCardAfterSuccess, 
  createStayPaymentSession, 
  confirmStayPayment,
  userPaymentMethodsList,
  userPaymentMethodsAdd,
  userPaymentMethodsSetDefault,
  userPaymentMethodsDelete,
  PaymentTest,
  testOneWayBooking,
  testRoundTripBooking
};
