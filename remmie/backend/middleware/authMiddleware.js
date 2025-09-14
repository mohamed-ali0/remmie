// const jwt = require('jsonwebtoken');

// const authenticate = (req, res, next) => {
//   const authHeader = req.headers.authorization;
  
//   if (!authHeader) {
//     return res.status(401).json({ message: 'No token provided' });
//   }

//   const token = authHeader.split(' ')[1]; // Get the token after 'Bearer '

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token
//     req.user = decoded; // Attach decoded data to request object (like user info)
//     next(); // Proceed to the next middleware/route handler
//   } catch (err) {
//     res.status(401).json({ message: 'Invalid or expired token' }); // If token is invalid/expired
//   }
// };

// module.exports = { authenticate };


// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    //req.user = decoded;   // { userId: …, iat: …, exp: … }

    req.user = {
      userId: decoded.userId,
      loginId: decoded.loginId, // ⬅️ Required for logout session tracking
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: err.name === 'TokenExpiredError'
      ? 'Token has expired'
      : 'Invalid token'
    });
  }
};

module.exports = { authenticate };
