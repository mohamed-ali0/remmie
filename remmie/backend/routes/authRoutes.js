const express = require('express');
const {
  userCreate,
  userLogin,
  userLogout,
  userInfo,
  userInfoUpdate,
  changePassword,
  userCheckEmail,
  userGoogleLogin
} = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const userProfileUpload = require('../middleware/userProfileUpload'); 


const router = express.Router();

router.post('/signup', userCreate);
router.post('/signin', userLogin);
router.post('/signout', authenticate, userLogout); // ✅ logout with token
router.post('/user-info', authenticate, userInfo);
router.post('/user-info-update', authenticate, userProfileUpload.single('profile_image'),userInfoUpdate);
router.post('/change-password', authenticate, changePassword);
router.post('/check-email', userCheckEmail);

router.post('/signin-google', userGoogleLogin);

module.exports = router;
