const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool, dbPrefix } = require('../config/db');
const { jwtSecret, jwtExpiresIn } = require('../config/auth');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// REGISTER
const userCreate = async (req, res) => {
  const { first_name, last_name, mobile, email, password } = req.body;
  if (!first_name || !last_name || !mobile || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [existing] = await pool.query(
      `SELECT * FROM ${dbPrefix}users WHERE email = ?`,
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO ${dbPrefix}users (first_name, last_name, mobile, email, password) 
       VALUES (?, ?, ?, ?, ?)`,
      [first_name, last_name, mobile, email, hashedPassword]
    );

    return res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Signup Error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// LOGIN
const userLogin = async (req, res) => {
  const { email, password, device_info = null } = req.body;

  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM ${dbPrefix}users WHERE email = ?`, [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    

    const baseUrl = process.env.BASE_URL; // ✅ set your BASE_URL in .env
    user.profile_image = user.profile_image
      ? `${baseUrl}/uploads/user_profile/${user.profile_image}`
      : null;

    const loginTime = new Date();

    // 1. Update trvl_users table
    await pool.query(
      `UPDATE ${dbPrefix}users 
       SET ip_address = ?, login_time = ?, updated_at = NOW() 
       WHERE id = ?`,
      [ip, loginTime, user.id]
    );

    // 2. Insert login history in trvl_user_logins
    const [loginResult] = await pool.query(
      `INSERT INTO ${dbPrefix}user_logins 
       (user_id, ip_address, user_agent, device_info, login_time, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [user.id, ip, userAgent, device_info, loginTime]
    );

    const loginId = loginResult.insertId;

    const token = jwt.sign(
      { userId: user.id, loginId },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );

    res.json({ message: 'Login successful', token, user_profile:user.profile_image,first_name:user.first_name,last_name:user.last_name });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GOOGLE LOGIN
const userGoogleLogin = async (req, res) => {
  try {
    const { token, device_info = null } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Google token is required' });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, given_name, family_name, picture, sub: googleId } = payload;

    // Get IP and User-Agent
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    // Check if user already exists
    const [rows] = await pool.query(
      `SELECT * FROM ${dbPrefix}users WHERE email = ?`,
      [email]
    );

    let user;
    if (rows.length > 0) {
      user = rows[0];
    } else {
      // New user
      const [result] = await pool.query(
        `INSERT INTO ${dbPrefix}users 
         (first_name, last_name, email, profile_image, google_id, created_at) 
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          given_name || '',
          family_name || '',
          email,
          picture || null,
          googleId
        ]
      );

      const [newUserRows] = await pool.query(
        `SELECT * FROM ${dbPrefix}users WHERE id = ?`,
        [result.insertId]
      );
      user = newUserRows[0];
    }

    const baseUrl = process.env.BASE_URL;
    user.profile_image = user.profile_image
      ? (user.profile_image.startsWith('http')
          ? user.profile_image
          : `${baseUrl}/uploads/user_profile/${user.profile_image}`)
      : null;

    const loginTime = new Date();
    await pool.query(
      `UPDATE ${dbPrefix}users 
       SET ip_address = ?, login_time = ?, updated_at = NOW() 
       WHERE id = ?`,
      [ip, loginTime, user.id]
    );

    const [loginResult] = await pool.query(
      `INSERT INTO ${dbPrefix}user_logins 
       (user_id, ip_address, user_agent, device_info, login_time, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [user.id, ip, userAgent, device_info, loginTime]
    );

    const loginId = loginResult.insertId;

    const jwtToken = jwt.sign(
      { userId: user.id, loginId },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );

    res.json({
      message: 'Google login successful',
      token: jwtToken,
      user_profile: user.profile_image
    });

  } catch (err) {
    console.error('Google Login Error:', err);
    res.status(401).json({ message: 'Invalid Google token' });
  }
};

// LOGOUT
const userLogout = async (req, res) => {
  const userId = req.user.userId;
  const loginId = req.user.loginId; // ⬅️ loginId token માથી લયીએ છીએ
  const logoutTime = new Date();

  try {
    // 1. Update logout_time in trvl_user_logins where id = loginId
    const [result] = await pool.query(
      `UPDATE ${dbPrefix}user_logins 
       SET logout_time = ? 
       WHERE id = ? AND user_id = ?`,
      [logoutTime, loginId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Login session not found or already logged out' });
    }

    return res.json({ message: 'Logout successful for this session' });
  } catch (err) {
    console.error('Logout Error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
// const userLogout = async (req, res) => {
//   const userId = req.user.userId;
//   const logoutTime = new Date();

//   try {
//     // 1. Update logout_time in trvl_users
//     await pool.query(
//       `UPDATE ${dbPrefix}users 
//        SET logout_time = ?, updated_at = NOW() 
//        WHERE id = ?`,
//       [logoutTime, userId]
//     );

//     // 2. Update latest login history logout_time
//     await pool.query(
//       `UPDATE ${dbPrefix}user_logins 
//        SET logout_time = ? 
//        WHERE user_id = ? 
//        ORDER BY id DESC LIMIT 1`,
//       [logoutTime, userId]
//     );

//     return res.json({ message: 'Logout time recorded successfully' });
//   } catch (err) {
//     console.error('Logout Error:', err);
//     return res.status(500).json({ message: 'Server error' });
//   }
// };

// PROFILE UPDATE
const userInfoUpdate = async (req, res) => {
  const userId = req.user.userId;
  const allowedFields = ['first_name', 'last_name', 'mobile'];

  const updates = [];
  const values = [];

  try {
    // ✅ Check if email provided and already exists for another user
    if (req.body.email) {
      const [rows] = await pool.query(
        `SELECT id FROM ${dbPrefix}users WHERE email = ? AND id != ?`,
        [req.body.email, userId]
      );

      if (rows.length > 0) {
        return res.status(409).json({ message: 'Email already in use by another account' });
      }

      updates.push(`email = ?`);
      values.push(req.body.email);
    }

    // ✅ Add other allowed fields dynamically
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        let newvalue = req.body[field];
        if (newvalue === null || newvalue === 'null') {
          newvalue = ''; // store empty string instead of null
        }
        updates.push(`${field} = ?`);
        //values.push(req.body[field]);
        values.push(newvalue);
      }
    }

    // ✅ Hash and update password if provided
    // if (req.body.password) {
    //   const hashedPassword = await bcrypt.hash(req.body.password, 10);
    //   updates.push(`password = ?`);
    //   values.push(hashedPassword);
    // }

    // ✅ If image uploaded
    if (req.file) {
      updates.push(`profile_image = ?`);
      values.push(req.file.filename);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    values.push(userId);

    await pool.query(
      `UPDATE ${dbPrefix}users 
       SET ${updates.join(', ')}, updated_at = NOW() 
       WHERE id = ?`,
      values
    );

    res.json({ message: 'User profile updated successfully' });

  } catch (err) {
    console.error('User Update Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// CHANGE PASSWORD
const changePassword = async (req, res) => {
  const userId = req.user.userId;

  try {
    // ✅ Get user current password from DB
    const [rows] = await pool.query(
      `SELECT password FROM ${dbPrefix}users WHERE id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success:false,message: 'User not found' });
    }

    const currentPassword = rows[0].password;

    // ✅ Check old + new password present
    if (!req.body.oldpassword || !req.body.newpassword) {
      return res.status(400).json({success:false,message: 'Old password and new password required' });
    }

    // ✅ Compare old password
    const isMatch = await bcrypt.compare(req.body.oldpassword, currentPassword);
    if (!isMatch) {
      return res.status(400).json({success:false,message: 'Old password is incorrect' });
    }

    // ✅ Hash new password
    const hashedPassword = await bcrypt.hash(req.body.newpassword, 10);

    // ✅ Update password in DB
    await pool.query(
      `UPDATE ${dbPrefix}users 
       SET password = ?, updated_at = NOW() 
       WHERE id = ?`,
      [hashedPassword, userId]
    );

    res.json({ success:true,message: 'Password updated successfully' });

  } catch (err) {
    console.error('Change Password Error:', err);
    res.status(500).json({ 
      message: 'Server error',
      error: err.message
    });
  }
};

// userinformation
const userInfo = async (req, res) => {
  const userId = req.user.userId;
  try {
    const [rows] = await pool.query(
      `SELECT id,first_name,last_name,email,mobile,profile_image
       FROM ${dbPrefix}users 
       WHERE id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

   const user = rows[0];
    const baseUrl = process.env.BASE_URL; // ✅ set your BASE_URL in .env
    // user.profile_image = user.profile_image
    //   ? `${baseUrl}/uploads/user_profile/${user.profile_image}`
    //   : null;
    user.profile_image = user.profile_image
      ? (user.profile_image.startsWith('http')
          ? user.profile_image
          : `${baseUrl}/uploads/user_profile/${user.profile_image}`)
      : null;
        
    res.json({
      success: true,
      data: user
    });

  } catch (err) {
    console.error('Get User Info Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// EMAIL CHECK
const userCheckEmail = async (req, res) => {
  const { email } = req.body;
  const [rows] = await pool.query(
    `SELECT 1 FROM ${dbPrefix}users WHERE email = ?`, [email]
  );
  res.json({ exists: !!rows.length });
};


module.exports = {
  userCreate,
  userLogin,
  userLogout,
  userInfo,
  userInfoUpdate,
  changePassword,
  userCheckEmail,
  userGoogleLogin
};
