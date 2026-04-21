import express from 'express';
import {
  register,
  login,
  forgotPassword,
  completeRegister,
  resetPassword,
  registerStepOneResponse,
  forgotPasswordStepOneResponse
} from '../controller/authController.js';
import { protect, authorizeRoles } from '../../../middlewares/authMiddleware.js';
import { validate } from '../../../middlewares/validateMiddleware.js';
import { userRegisterSchema } from '../validator/userValidation.js';
import { sendOtpForUser, verifyOtp } from '../../../middlewares/otpMiddleware.js';
const router = express.Router();

//Public routes
router.post(
  '/register',
  validate(userRegisterSchema),
  register,
  sendOtpForUser('Your activation code (insightO)', 'Welcome to insightO! Your activation code is:'),
  registerStepOneResponse
);
router.post('/register/verify', verifyOtp, completeRegister);
router.post('/login', login);
router.post(
  '/forgotPassword',
  forgotPassword,
  sendOtpForUser('Your Verification Code (insightO)', 'Your verification code is:'),
  forgotPasswordStepOneResponse
);
router.patch('/resetPassword', verifyOtp, resetPassword);

//Protected routes
router.get('/profile', protect, (req, res) => {
  res.status(200).json({
    message: 'Profile data retrieved successfully',
    user: (req as any).user
  });
});
router.get('/admin', protect, authorizeRoles('ADMIN', 'SUPER ADMIN'), (req, res) => {
  res.status(200).json({
    message: 'Welcome to the admin area',
  });
});

export default router;
