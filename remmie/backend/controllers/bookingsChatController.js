// bookingsChatController.js
const axios = require('axios');
const { pool, dbPrefix } = require('../config/db');
require('dotenv').config();

const storeMessage = async (req, res) => {
  let { sessionId, message, sender, userId } = req.body;

  if (!sessionId || !message || !sender) {
    return res.status(400).json({ error: 'Missing sessionId, message, or sender' });
  }

  try {
    // ✅ Decode Base64 userId
    if (userId) {
      const buffer = Buffer.from(userId, 'base64');
      userId = parseInt(buffer.toString('utf8'), 10);
    }

    // Step 1: Ensure session entry exists
    await pool.execute(
      `INSERT IGNORE INTO ${dbPrefix}bookings_chat_sessions (session_id, user_id) VALUES (?, ?)`,
      [sessionId, userId]
    );

    // Step 2: Insert message
    await pool.execute(
      `INSERT INTO ${dbPrefix}bookings_chat_messages (session_id, message, sender, user_id) VALUES (?, ?, ?, ?)`,
      [sessionId, message, sender, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('DB insert error:', err);
    res.status(500).json({ error: 'Database insert failed' });
  }
};

const findMessage = async (req, res) => {
  const { email, phone, userId: encodedUserId } = req.body;

  if (!email && !phone && !encodedUserId) {
    return res.status(400).json({ success: false, message: "Email or phone or userId is required" });
  }

  try {
    const conditions = [];
    const values = [];

    if (email) {
      conditions.push("message LIKE ?");
      values.push(`%${email}%`);
    }
    if (phone) {
      conditions.push("message LIKE ?");
      values.push(`%${phone}%`);
    }

    let decodedUserId = null;
    if (encodedUserId) {
      const buffer = Buffer.from(encodedUserId, 'base64');
      decodedUserId = parseInt(buffer.toString('utf8'), 10);
      
      if (!isNaN(decodedUserId)) {
        conditions.push("user_id = ?");
        values.push(decodedUserId);
      }
      
    }

    // Only add WHERE clause if we have conditions
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" OR ")}` : '';

    // Step 1: Get latest 2 session_ids (fix DISTINCT + ORDER BY issue)
    const [sessions] = await pool.execute(
      `SELECT session_id, MAX(id) as max_id
       FROM ${dbPrefix}bookings_chat_messages 
       ${whereClause} 
       GROUP BY session_id
       ORDER BY max_id DESC 
       LIMIT 2`,
      values
    );

    if (!sessions.length) {
      return res.json({ success: true, message: "No sessions found", data: [] });
    }

    const sessionIds = sessions.map(row => row.session_id);

    // Step 2: Get all messages for those sessions (with user_id)
    const [messages] = await pool.execute(
      `SELECT session_id, message, sender, user_id, created_at 
       FROM trvl_bookings_chat_messages 
       WHERE session_id IN (${sessionIds.map(() => '?').join(',')}) 
       ORDER BY session_id, created_at ASC`,
      sessionIds
    );

    // Step 3: Group messages by session
    const groupedMessages = {};
    const userIdsSet = new Set();

    for (const msg of messages) {
      if (!groupedMessages[msg.session_id]) {
        groupedMessages[msg.session_id] = [];
      }
      groupedMessages[msg.session_id].push(msg);
      if (msg.user_id) {
        userIdsSet.add(msg.user_id);
      }
    }

    // Step 4: Get user details
    const userIds = Array.from(userIdsSet);
    let users = [];

    if (userIds.length) {
      const [userRows] = await pool.execute(
        `SELECT first_name, last_name, email, mobile FROM ${dbPrefix}users  WHERE id IN (${userIds.map(() => '?').join(',')})`,
        userIds
      );
      users = userRows;
    }

    
    // Step 5: Get user last booking details
    let last_booking = {
      hotel: null,
      flight: null
    };

    if (userIds.length) {
      const [lastBookingRows] = await pool.execute(
        `SELECT id, booking_type, stays_quotes, flight_offers, guest_details
         FROM ${dbPrefix}bookings
         WHERE user_id IN (${userIds.map(() => '?').join(',')})
         ORDER BY id DESC LIMIT 1`,
        userIds
      );

      if (lastBookingRows.length) {
        last_booking = formatLastBooking(lastBookingRows[0]);
      }

      
    }

    //res.json({ success: true, sessions: groupedMessages, users, last_booking });
    res.json({ success: true, users, last_booking });
    // res.json({ success: true, sessions: groupedMessages, users, last_booking});


    

  } catch (err) {
    console.error("Message fetch error:", err);
    res.status(500).json({ success: false, message: "Server error"});
  }
};

function formatLastBooking(row) {
  if (!row) return { hotel: null, flight: null };

  // -------- Hotel Booking --------
  if (row.booking_type === "stays") {
    let stays = null;
    try {
      const staysData = row.stays_quotes ? JSON.parse(row.stays_quotes) : null;
      const guestDetails = row.guest_details ? JSON.parse(row.guest_details) : null;
      
      const data = staysData.data;
      if (data) {
        stays = {

          booking_id: row.id,
          booking_type: row.booking_type,
          currency: data.total_currency,
          base_amount: data.base_amount,
          fee_amount: data.fee_amount,
          tax_amount: data.tax_amount,
          total_amount: data.total_amount,

          hotel: {

            name: data.accommodation?.name,
            city: data.accommodation?.city,
            address: data.accommodation?.location?.address,
            room: data.rooms,

            check_in: data.check_in_date,
            check_out: data.check_out_date,
            rooms: (data.accommodation?.rooms || []).map(r => ({
                name: r.name,
                beds: r.beds
                
              })) 
          },
          guests: (guestDetails?.guests || []).map(g => ({
            id: g.id,
            type: g.type,
            title: g.title,
            name: `${g.given_name} ${g.family_name}`,
            dob: g.born_on,
            gender: g.gender,
            phone: g.phone_number,
            email: g.email
          })),
          guests_contact:{
            email:guestDetails?.email,
            phone_number:guestDetails?.phone_number  
          }
          


          
        };
      }
    } catch (e) {
      console.error("Hotel parse error:", e);
    }

    return { hotel: stays, flight: null };
  }else{
    // -------- Flight Booking --------  
    let flight = null;
    try {
      const flightOffers = row.flight_offers ? JSON.parse(row.flight_offers) : null;
      const guestDetails = row.guest_details ? JSON.parse(row.guest_details) : null;

      if (flightOffers) {
        const data = flightOffers.data;

        // --- Extract price ---
        const price = {
          currency: data.total_currency,
          base_amount: data.base_amount,
          tax_amount: data.tax_amount,
          total_amount: data.total_amount
        };

        // --- Extract flights ---
        const flights = [];
        (data.slices || []).forEach(slice => {
          (slice.segments || []).forEach(segment => {
            flights.push({
              origin: {
                city: segment.origin.city_name,
                iata_code: segment.origin.iata_code,
                airport_name: segment.origin.name
              },
              destination: {
                city: segment.destination.city_name,
                iata_code: segment.destination.iata_code,
                airport_name: segment.destination.name
              },
              departing_at: segment.departing_at,
              arriving_at: segment.arriving_at,
              carrier: segment.marketing_carrier?.name,
              flight_number: segment.marketing_carrier_flight_number,
              cabin_class: segment.passengers?.[0]?.cabin_class,
              duration: segment.duration,
              baggage: segment.passengers?.[0]?.baggages?.map(b => ({
                type: b.type,
                quantity: b.quantity
              })) || []
            });
          });
        });

        // --- Extract guests ---
        const guests = (guestDetails?.passengers || []).map(p => ({
          id: p.id,
          type: p.type,
          title: p.title,
          name: `${p.given_name} ${p.family_name}`,
          dob: p.born_on,
          gender: p.gender,
          phone: p.phone_number,
          email: p.email,
          infant_id: p.infant_passenger_id || null
        }));

        flight = {
          booking_id: row.id,
          booking_type: row.booking_type,
          ...price,
          flights,
          guests
        };
      }
    } catch (e) {
      console.error("Flight parse error:", e);
    }

    return { hotel: null, flight };
  }

  // -------- Unknown type --------
  return { hotel: null, flight: null };
}

const findUserMessage = async (req, res) => {
  let { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "UserId is required" });
  }

  // ✅ Base64 decode userId
  try {
    const buffer = Buffer.from(userId, 'base64');
    userId = parseInt(buffer.toString('utf8'), 10);
  } catch (err) {
    return res.status(400).json({ success: false, message: "Invalid userId format" });
  }

  try {
    // ✅ STEP 1: Get user details from trvl_users
    const [userResult] = await pool.execute(
      `SELECT first_name, last_name, email, mobile 
       FROM ${dbPrefix}users 
       WHERE id = ? 
       LIMIT 1`,
      [userId]
    );

    const userInfo = userResult.length ? userResult[0] : null;

    // ✅ STEP 2: Get recent 2 sessions by userId
    const [sessions] = await pool.execute(
      `SELECT session_id 
       FROM ${dbPrefix}bookings_chat_sessions 
       WHERE user_id = ? 
       ORDER BY id DESC 
       LIMIT 2`,
      [userId]
    );

    if (!sessions.length) {
      return res.json({ success: true, message: "No sessions found", data: [], user: userInfo });
    }

    const sessionIds = sessions.map(row => row.session_id);

    // ✅ STEP 3: Get all messages for those session IDs
    const placeholders = sessionIds.map(() => '?').join(',');
    const [messages] = await pool.execute(
      `SELECT session_id, message, sender, created_at 
       FROM ${dbPrefix}bookings_chat_messages 
       WHERE session_id IN (${placeholders}) 
       ORDER BY session_id, created_at ASC`,
      sessionIds
    );

    // ✅ STEP 4: Group messages by session
    const grouped = {};
    for (const msg of messages) {
      if (!grouped[msg.session_id]) {
        grouped[msg.session_id] = [];
      }
      grouped[msg.session_id].push(msg);
    }

    res.json({ success: true, user: userInfo, sessions: grouped });

  } catch (err) {
    console.error("Message fetch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }

};

const findUser = async (req, res) => {
  let { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "UserId is required" });
  }

  // ✅ Base64 decode userId
  try {
    const buffer = Buffer.from(userId, 'base64');
    userId = parseInt(buffer.toString('utf8'), 10);
  } catch (err) {
    return res.status(400).json({ success: false, message: "Invalid userId format" });
  }

  try {
    // ✅ STEP 1: Get user details from trvl_users
    const [userResult] = await pool.execute(
      `SELECT first_name, last_name, email, mobile 
       FROM ${dbPrefix}users 
       WHERE id = ? 
       LIMIT 1`,
      [userId]
    );

    const userInfo = userResult.length ? userResult[0] : null;
    res.json({ success: true, user: userInfo });

  } catch (err) {
    console.error("Message fetch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// const findMessage = async (req, res) => {
//   const { email, phone } = req.body;

//   if (!email && !phone) {
//     return res.status(400).json({ success: false, message: "Email or phone is required" });
//   }

//   try {
//     const conditions = [];
//     const values = [];

//     if (email) {
//       conditions.push("message LIKE ?");
//       values.push(`%${email}%`);
//     }
//     if (phone) {
//       conditions.push("message LIKE ?");
//       values.push(`%${phone}%`);
//     }

//     const whereClause = `WHERE ${conditions.join(" OR ")}`;

//     // STEP 1: Get recent 2 session_ids where message contains email/phone
//     const [sessions] = await pool.execute(
//       `SELECT DISTINCT session_id 
//        FROM trvl_bookings_chat_messages 
//        ${whereClause} 
//        ORDER BY id DESC 
//        LIMIT 2`,
//       values
//     );

//     if (!sessions.length) {
//       return res.json({ success: true, message: "No sessions found", data: [] });
//     }

//     const sessionIds = sessions.map(row => row.session_id);

//     // STEP 2: Get all messages for those sessions
//     const [messages] = await pool.execute(
//       `SELECT session_id, message, sender, created_at 
//        FROM trvl_bookings_chat_messages 
//        WHERE session_id IN (${sessionIds.map(() => '?').join(',')}) 
//        ORDER BY session_id, created_at ASC`,
//       sessionIds
//     );

//     // STEP 3: Group messages by session
//     const grouped = {};
//     for (const msg of messages) {
//       if (!grouped[msg.session_id]) {
//         grouped[msg.session_id] = [];
//       }
//       grouped[msg.session_id].push(msg);
//     }

//     res.json({ success: true, sessions: grouped });

//   } catch (err) {
//     console.error("Message fetch error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// const findMessage = async (req, res) => {
//   let { userId } = req.body;

//   if (!userId) {
//     return res.status(400).json({ success: false, message: "UserId is required" });
//   }

//   // ✅ Base64 decode userId
//   try {
//     const buffer = Buffer.from(userId, 'base64');
//     userId = parseInt(buffer.toString('utf8'), 10);
//   } catch (err) {
//     return res.status(400).json({ success: false, message: "Invalid userId format" });
//   }

//   try {
//     // ✅ STEP 1: Get user details from trvl_users
//     const [userResult] = await pool.execute(
//       `SELECT first_name, last_name, email, mobile 
//        FROM ${dbPrefix}users 
//        WHERE id = ? 
//        LIMIT 1`,
//       [userId]
//     );

//     const userInfo = userResult.length ? userResult[0] : null;

//     // ✅ STEP 2: Get recent 2 sessions by userId
//     const [sessions] = await pool.execute(
//       `SELECT session_id 
//        FROM ${dbPrefix}bookings_chat_sessions 
//        WHERE user_id = ? 
//        ORDER BY id DESC 
//        LIMIT 2`,
//       [userId]
//     );

//     if (!sessions.length) {
//       return res.json({ success: true, message: "No sessions found", data: [], user: userInfo });
//     }

//     const sessionIds = sessions.map(row => row.session_id);

//     // ✅ STEP 3: Get all messages for those session IDs
//     const placeholders = sessionIds.map(() => '?').join(',');
//     const [messages] = await pool.execute(
//       `SELECT session_id, message, sender, created_at 
//        FROM ${dbPrefix}bookings_chat_messages 
//        WHERE session_id IN (${placeholders}) 
//        ORDER BY session_id, created_at ASC`,
//       sessionIds
//     );

//     // ✅ STEP 4: Group messages by session
//     const grouped = {};
//     for (const msg of messages) {
//       if (!grouped[msg.session_id]) {
//         grouped[msg.session_id] = [];
//       }
//       grouped[msg.session_id].push(msg);
//     }

//     res.json({ success: true, user: userInfo, sessions: grouped });

//   } catch (err) {
//     console.error("Message fetch error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

module.exports = {
  storeMessage,
  findMessage,
  findUser,
  findUserMessage
};