// flightController
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { pool, dbPrefix } = require('../config/db');

require('dotenv').config();
const duffel_access_tokens = process.env.DUFFEL_ACCESS_TOKENS;
const duffel_api_url = process.env.DUFFEL_API_URL;
const booking_base_url = process.env.STAY_BOOKING_BASE_URL;

const accommodationSuggestions = async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !data.query) {
      return res.status(400).json({ error: 'Query field is required in data object' });
    }

    const response = await axios.post(
      `${duffel_api_url}/stays/accommodation/suggestions`,
      { data }, // ⚠️ Send it as-is
      {
        headers: {
          'Duffel-Version': 'v2',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${duffel_access_tokens}`,
        },
      }
    );

    return res.status(200).json(response.data);
  } catch (error) {
    console.error(error?.response?.data || error.message);
    return res.status(500).json({
      error: 'Something went wrong while fetching accommodation suggestions',
      details: error?.response?.data || error.message,
    });
  }
};

const staysSearch = async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'data field is required in request body' });
    }

    const response = await axios.post(`${duffel_api_url}/stays/search`, { data }, {
      headers: {
        'Duffel-Version': 'v2',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${duffel_access_tokens}`,
      },
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error(error?.response?.data || error.message);
    return res.status(500).json({
      error: 'Something went wrong while searching for stays',
      details: error?.response?.data || error.message,
    });
  }
};

const staysQuotes = async (req, res) => {
  try {

    const { data } = req.body;

      if (!data) {
        return res.status(400).json({ error: 'data field is required in request body' });
      }
      const response = await axios.post(`${duffel_api_url}/stays/quotes`, { data },
      {
        headers: {
          'Duffel-Version': 'v2',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${duffel_access_tokens}`
        }
      }
    );

    return res.json(response.data);

  } catch (error) {
    console.error(error?.response?.data || error.message);
    return res.status(500).json({ error: 'Something went wrong', details: error?.response?.data || error.message });
  }
};

const staysQuoteById = async (req, res) => {
  try {
    const quote_id = req.query.quote_id;
    if (!quote_id) {
      return res.status(400).json({ error: 'quote_id is required in request body -> data.quote_id' });
    }

    const response = await axios.get(`${duffel_api_url}/stays/quotes/${quote_id}`, {
      headers: {
        'Duffel-Version': 'v2',
        'Authorization': `Bearer ${duffel_access_tokens}`
      }
    });

    return res.json(response.data);
  } catch (error) {
    console.error('Duffel API Error:', error?.response?.data || error.message);
    return res.status(500).json({
      error: 'Something went wrong',
      details: error?.response?.data || error.message
    });
  }
};



// const bookings = async (req, res) => {
//     try {
//       const response = await axios.post(
//         'https://api.duffel.com/stays/bookings',
//         req.body, // આખો body pass કરો એમાં quote_id, guests, email, phone_number બધું હોવું જોઈએ
//         {
//           headers: {
//             'Duffel-Version': 'v2',
//             'Content-Type': 'application/json',
//             'Authorization': 'Bearer duffel_test_VGrsagU34pypbwSH0NmSJ1TCuJxH5PPseA8gOrcO4qE'
//           }
//         }
//       );

//       return res.json(response.data);

//     } catch (error) {
//       console.error(error?.response?.data || error.message);
//       return res.status(500).json({ error: 'Something went wrong', details: error?.response?.data || error.message });
//     }
// };

 const createOrderLink = async (req, res) => {
  const requestData = req.body;

  if (
    !requestData ||
    !requestData.data ||
    !requestData.data.quote_id ||
    !Array.isArray(requestData.data.guests) || requestData.data.guests.length === 0 ||
    !requestData.data.email ||
    !requestData.data.phone_number
  ) {
    return res.status(400).json({ message: 'Invalid or incomplete stay booking data.' });
  }

  try {
    let bookingRef;
    let isUnique = false;
    // Generate unique booking reference
    while (!isUnique) {
      bookingRef = `STAY-${uuidv4().slice(0, 8).toUpperCase()}`;
      const [existing] = await pool.query(
        `SELECT 1 FROM ${dbPrefix}bookings WHERE booking_reference = ? LIMIT 1`,
        [bookingRef]
      );
      isUnique = existing.length === 0;
    }
    // Save booking JSON to DB
    const [result] = await pool.query(
      `INSERT INTO ${dbPrefix}bookings (booking_type,booking_reference, booking_json, created_at)
       VALUES ('stays',?, ?, NOW())`,
      [bookingRef, JSON.stringify(requestData)]
    );
    // Return booking link and details
    return res.status(201).json({
      success: true,
      message: 'Stay booking saved successfully',
      booking_reference: bookingRef,
      booking_id: result.insertId,
      booking_url: `${booking_base_url}?booking_ref=${bookingRef}`
    });

  } catch (err) {
    console.error('Error saving stay booking:', err);
    return res.status(500).json({ message: 'Server error', error: err });
  }
};
const saveStayAmount = async (req, res) => {
    try {
        // 🔽 1. Extract request body
        const requestData = req.body.data;

        // 🔍 2. Validate input
        if (
            !requestData ||
            !requestData.booking_id ||
            !requestData.stays_quotes ||
            !requestData.base_amount ||
            !requestData.tax_amount ||
            !requestData.total_amount ||
            !requestData.currency
        ) {
            return res.status(400).json({ error: 'Missing required fields', requestData });
        }

        //res.json(JSON.stringify(requestData.stays_quotes));

        // 🛠️ 3. Build SQL Query
        const query = `
            UPDATE ${dbPrefix}bookings
            SET 
                stays_quotes = ?,
                amount = ?, 
                currency = ?, 
                updated_at = NOW()
            WHERE id = ?
        `;

        // 🔄 4. Execute query with parameters
        const [result] = await pool.query(query, [
            JSON.stringify(requestData.stays_quotes),
            requestData.total_amount,
            requestData.currency,
            requestData.booking_id
        ]);

        // 📦 5. Check update success
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Booking ID not found' });
        }

        // ✅ 6. Success response
        res.json({ success: true, message: 'Offer updated successfully' });

    } catch (err) {
        console.error('Update Error:', err);
        res.status(500).json({ error: 'Database error', detail: err.message });
    }
};


const createConformOrder = async (req, res) => {
    try {
      const requestData = req.body;
      const id = requestData.id;
      const data = requestData.data;
      
      const response = await axios.post(
        'https://api.duffel.com/stays/bookings',
        { data }, 
        {
          headers: {
            'Duffel-Version': 'v2',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer duffel_test_VGrsagU34pypbwSH0NmSJ1TCuJxH5PPseA8gOrcO4qE'
          }
        }
      );

    // ✅ Save this Duffel response
    const conformOrderJson = response.data;
    // 🛠️ Update database
    const query = `
      UPDATE ${dbPrefix}bookings
      SET 
          conform_order_json = ?,
          updated_at = NOW()
      WHERE id = ?
    `;
    const [result] = await pool.query(query, [
      JSON.stringify(conformOrderJson),
      id
    ]);
    // Return Duffel's success response
    res.status(response.status).json(conformOrderJson);

    } catch (error) {
      // Return Duffel error as-is
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({
          error: true,
          message: error.message
        });
      }
    }
};
module.exports = {
  accommodationSuggestions,staysSearch,staysQuotes,staysQuoteById,createOrderLink,saveStayAmount,createConformOrder
};

