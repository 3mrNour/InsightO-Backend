// import express from 'express';
// import {
//   register,
//   login,
//   forgotPassword,
//   completeRegister,
//   resetPassword,
//   registerStepOneResponse,
//   forgotPasswordStepOneResponse,
//   verifyOTP
// } from '../controller/authController.js';
// import { protect, authorizeRoles } from '../../../middlewares/authMiddleware.js';
// import { validate } from '../../../middlewares/validateMiddleware.js';
// import { userRegisterSchema } from '../validator/userValidation.js';
// import { sendOtpForUser } from '../../../middlewares/otpMiddleware.js';
// const router = express.Router();

// //Public routes
// router.post(
//   '/register',
//   validate(userRegisterSchema),
//   register,
//   sendOtpForUser('Your activation code (insightO)', 'Welcome to insightO! Your activation code is:'),
//   registerStepOneResponse
// );
// router.post('/register/verify', verifyOTP);
// router.post('/login', login);
// router.post(
//   '/forgotPassword',
//   forgotPassword,
//   sendOtpForUser('Your Verification Code (insightO)', 'Your verification code is:'),
//   forgotPasswordStepOneResponse
// );
// router.patch('/resetPassword', verifyO, resetPassword);

// //Protected routes
// router.get('/profile', protect, (req, res) => {
//   res.status(200).json({
//     message: 'Profile data retrieved successfully',
//     user: (req as any).user
//   });
// });
// router.get('/admin', protect, authorizeRoles('ADMIN', 'SUPER ADMIN'), (req, res) => {
//   res.status(200).json({
//     message: 'Welcome to the admin area',
//   });
// });

// export default router;

import express from 'express';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  registerStepOneResponse,
  forgotPasswordStepOneResponse,
  verifyOTP, // الكنترولر المسؤول عن نقل البيانات من التيمب للأصلي
  approvePendingUser,
  getPendingUsersForAdmin,
  updateProfile,
  changePassword
} from '../controller/authController.js';

import { protect, authorizeRoles } from '../../../middlewares/authMiddleware.js';
import { validate } from '../../../middlewares/validateMiddleware.js';
import { userRegisterSchema } from '../validator/userValidation.js';
import { sendOtpForUser, verifyOtp } from '../../../middlewares/otpMiddleware.js'; // استيراد الميدل وير

const router = express.Router();

// --- [ Public Routes ] ---

// 1. التسجيل (المرحلة الأولى: حفظ مؤقت وإرسال إيميل)
router.post(
  '/register',
  validate(userRegisterSchema),
  register,
  // ملاحظة: لو الكنترولر بتاعك جواه sendEmail، شيل السطر اللي تحت ده عشان ميبعتش إيميلين
  // sendOtpForUser('Activation Code', 'Welcome! Your code is:'), 
  registerStepOneResponse
);

// 2. تفعيل الحساب (المرحلة الثانية: نقل البيانات للـ Users)
router.post('/register/verify', verifyOTP); 

// 3. تسجيل الدخول
router.post('/login', login);

// 4. نسيان الباسورد (المرحلة الأولى: إرسال الكود)
router.post(
  '/forgotPassword',
  forgotPassword,
  sendOtpForUser('Verification Code', 'Your verification code is:'),
  forgotPasswordStepOneResponse
);

// 5. إعادة تعيين الباسورد (المرحلة الثانية: فحص الكود ثم التغيير)
router.patch(
  '/resetPassword', 
  verifyOtp,      // الميدل وير بيفحص الكود وبيعمل next() لو صح
  resetPassword   // الكنترولر بيغير الباسورد فعلياً
);

// --- [ Protected Routes ] ---

import { upload } from '../../../utils/upload/multerConfig.js';

router.get('/profile', protect, (req, res) => {
  res.status(200).json({ status: 'success', user: (req as any).user });
});

router.put('/profile', protect, upload.single('profileImage'), updateProfile);
router.patch('/profile/password', protect, changePassword);

router.post('/admin/pending/:pendingUserId/approve', protect, authorizeRoles('ADMIN'), approvePendingUser);
router.get('/admin/pending-users', protect, authorizeRoles('ADMIN'), getPendingUsersForAdmin);

export default router;