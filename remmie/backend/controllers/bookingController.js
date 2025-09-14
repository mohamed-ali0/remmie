// controllers/bookingController.js
const { v4: uuidv4 } = require('uuid');
const { pool, dbPrefix } = require('../config/db');

// first time save chect box data
const getBookingData = async (req, res) => {

  const { flight_details,phone_number } = req.body;
  
  if (!flight_details) {
    return res.status(400).json({ message: 'flight_details is required' });
  }
  if (!phone_number) {
    return res.status(400).json({ message: 'phone number is required' });
  }

  try {
    let bookingRef;
    let isUnique = false;

    // Try until we get a unique booking reference
    while (!isUnique) {
      bookingRef = `BOOK-${uuidv4().slice(0, 6).toUpperCase()}`;
      const [existing] = await pool.query(
        `SELECT 1 FROM ${dbPrefix}bookings WHERE booking_reference = ? LIMIT 1`,
        [bookingRef]
      );
      isUnique = existing.length === 0;
    }

    // Save booking
    const [result] = await pool.query(
      `INSERT INTO ${dbPrefix}bookings (phone_number,booking_reference, flight_details, created_at)
       VALUES (?,?, ?, NOW())`,
      [phone_number, bookingRef, JSON.stringify(flight_details)]
    );

    return res.status(201).json({
      success: true,
      message: 'Booking saved successfully',
      booking_reference: bookingRef,
      booking_id: result.insertId
    });

  } catch (err) {
    console.error('Error saving booking:', err);
    return res.status(500).json({ message: 'Server error',error:err });
  }
};

// 2. Get booking by reference and assign user if needed
const getBookingByRef = async (req, res) => {
  const { booking_ref } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (!booking_ref) {
    return res.status(400).json({ message: 'Booking reference is required' });
  }

  try {
    // 1) Fetch the booking by reference
    const [rows] = await pool.query(
      `SELECT * 
         FROM ${dbPrefix}bookings 
        WHERE booking_reference = ? 
        LIMIT 1`,
      [booking_ref]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = rows[0];

    // 2) If user_id is empty/null, assign this booking to the current user
    if (!booking.user_id) {
      await pool.query(
        `UPDATE ${dbPrefix}bookings 
            SET user_id = ? 
          WHERE id = ?`,
        [userId, booking.id]
      );
      booking.user_id = userId;
    }
    // 3) If booking already belongs to someone else, forbid access
    else if (booking.user_id !== userId) {
      return res.status(403).json({ message: 'You do not have access to this booking' });
    }

    // 4) Return the (possibly updated) booking
    return res.json(booking);
  } catch (err) {
    console.error('Error fetching or assigning booking:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};



// 3. Get user wise booking list
const getUserBookingList = async (req, res) => {
  const userId = req.user?.userId; // Parsed from token middleware
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * 
         FROM ${dbPrefix}bookings 
        WHERE user_id = ? 
        ORDER BY id DESC`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No bookings found for this user.' });
    }

    return res.status(200).json({
      success: true,
      total: rows.length,
      bookings: rows
    });

  } catch (err) {
    console.error('Error fetching user bookings:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 3. Get user wise stays booking list
const getUserStaysBookingList = async (req, res) => {
  const userId = req.user?.userId; // Parsed from token middleware
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * 
         FROM ${dbPrefix}bookings 
        WHERE user_id = ? 
        AND booking_type = 'stays'
        ORDER BY id DESC`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(200).json({ message: 'No bookings found for this user.' });
    }

    return res.status(200).json({
      success: true,
      total: rows.length,
      bookings: rows
    });

  } catch (err) {
    console.error('Error fetching user bookings:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 4. Get user wise booking list
const getUserSingleBooking = async (req, res) => {
  const userId = req.user?.userId;
  const { booking_ref } = req.body;
  
  if (!userId || !booking_ref) {
    return res.status(400).json({ message: 'User ID and Booking ref required' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * 
         FROM ${dbPrefix}bookings 
        WHERE booking_reference = ? AND user_id = ? 
        LIMIT 1`,
      [booking_ref, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    return res.json({ success: true, booking: rows[0] });

  } catch (err) {
    console.error('Error fetching booking:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};


// 5. Get user wise stays booking list
const getUserStaysSingleBooking = async (req, res) => {
  const userId = req.user?.userId;
  const { booking_ref } = req.body;
  
  if (!userId || !booking_ref) {
    return res.status(400).json({ message: 'User ID and Booking ref required' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * 
         FROM ${dbPrefix}bookings 
        WHERE booking_reference = ? AND user_id = ? AND booking_type = 'stays'
        LIMIT 1`,
      [booking_ref, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    return res.json({ success: true, booking: rows[0] });

  } catch (err) {
    console.error('Error fetching booking:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getBookingData,
                    getBookingByRef,
                    getUserBookingList,
                    getUserSingleBooking,
                    getUserStaysBookingList,
                    getUserStaysSingleBooking
                  };
