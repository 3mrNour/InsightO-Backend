import type { NextFunction, Request, Response } from 'express';
import User from '../model/User_Schema.js';
import PendingUser from '../model/PendingUser.js';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { AppError } from '../../../utils/AppError.js';
import sendEmail from '../../../utils/Email.js';
import StudentProfile from '../../profile/model/StudentProfile.js';
import InstructorProfile from '../../profile/model/InstructorProfile.js';
import HODProfile from '../../profile/model/HODProfile.js';
import Department from '../../department/model/Department.js';
import { UserSchema } from '../../../utils/User.js';

const generateToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d'
  });
};


// Register Controller

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, email, password, role, nationalId } = req.body;

    // Check if user exists in Users or PendingUser
    const [existingUser, existingPending] = await Promise.all([
      User.findOne({ $or: [{ email }, { nationalId }] }),
      PendingUser.findOne({ $or: [{ email }, { nationalId }] })
    ]);
    if (existingUser || existingPending) {
      return next(new AppError('Email or National ID is already registered or pending verification', 409));
    }

    // Hash password
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save to PendingUser
    const pendingUser = await PendingUser.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: role || 'STUDENT',
      nationalId,
      otp,
      otpExpires
    });

    // Send OTP email
    await sendEmail({
      email,
      subject: 'Your activation code (insightO)',
      message: `Welcome to insightO! Your activation code is: ${otp}`
    });

    (req as Request & { otpEmail?: string }).otpEmail = email;
    return next();
  } catch (error: any) {
    return next(new AppError(error.message || 'Server error during registration', 500));
  }
};

export const registerStepOneResponse = async (req: Request, res: Response) => {
  return res.status(201).json({
    status: 'success',
    message: 'Step 1 complete. OTP sent to your email',
    email: (req as Request & { otpEmail?: string }).otpEmail || req.body.email
  });
};


// login Controller

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Please provide email and password' });
      return;
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcryptjs.compare(password, user.password as string);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user._id.toString(), user.role);

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
};


// forget password Controller

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ status: 'fail', message: "Your email isn't registered with us" });
  }

  (req as Request & { otpUserId?: string; otpEmail?: string }).otpUserId = user._id.toString();
  (req as Request & { otpUserId?: string; otpEmail?: string }).otpEmail = user.email;
  return next();
};

export const forgotPasswordStepOneResponse = async (req: Request, res: Response) => {
  return res.status(200).json({
    status: 'success',
    message: 'OTP sent to your email',
    email: (req as Request & { otpEmail?: string }).otpEmail || req.body.email
  });
};


export const completeRegister = async (req: Request, res: Response) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return res.status(404).json({ status: 'fail', message: "Your email isn't registered with us" });
  }

  user.isVerified = true;
  await user.save({ validateBeforeSave: false });

  const token = generateToken(user._id.toString(), user.role);
  return res.status(200).json({
    status: 'success',
    message: 'Account verified successfully',
    token,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    }
  });
};


//reset password Controller

export const resetPassword = async (req: Request, res: Response) => {
  const { email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({
      status: 'fail',
      message: 'password and confirmPassword must match'
    });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      status: 'fail',
      message: 'Your email is not registered with us'
    });
  }

  user.password = await bcryptjs.hash(password, 10);
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Congratulations! Your password has been changed successfully, you can now log in'
  });
};

export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      throw new AppError('Email and OTP are required', 400);
    }
    // Find pending user
    const pendingUser = await PendingUser.findOne({ email });
    if (!pendingUser) {
      throw new AppError('No pending registration found for this email', 404);
    }
    if (pendingUser.otp !== otp || !pendingUser.otpExpires || Date.now() > pendingUser.otpExpires.getTime()) {
      throw new AppError('Invalid or expired OTP', 400);
    }
    pendingUser.otp = '';
    pendingUser.otpExpires = new Date(0);
    pendingUser.otpVerified = true;
    pendingUser.approvalStatus = 'PENDING_ADMIN_APPROVAL';
    await pendingUser.save({ validateBeforeSave: false });

    return res.status(200).json({
      status: 'success',
      message: 'OTP verified successfully. Your account is pending admin approval.'
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ status: error.status, message: error.message });
    }
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

export const approvePendingUser = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  const { pendingUserId } = req.params;
  const { academicYear, departmentId } = req.body;

  const session = await PendingUser.startSession();
  session.startTransaction();

  try {
    const pendingUser = await PendingUser.findById(pendingUserId).select('+password').session(session);
    if (!pendingUser) {
      throw new AppError('Pending user not found', 404);
    }

    if (!pendingUser.otpVerified || pendingUser.approvalStatus !== 'PENDING_ADMIN_APPROVAL') {
      throw new AppError('Pending user is not ready for admin approval', 400);
    }

    if (pendingUser.role === UserSchema.STUDENT && (academicYear === undefined || !departmentId)) {
      throw new AppError('academicYear and departmentId are required when approving STUDENT', 400);
    }

    if (
      (pendingUser.role === UserSchema.INSTRUCTOR || pendingUser.role === UserSchema.HOD) &&
      !departmentId
    ) {
      throw new AppError('departmentId is required when approving INSTRUCTOR/HOD', 400);
    }

    if (departmentId) {
      const department = await Department.findById(departmentId).session(session);
      if (!department) {
        throw new AppError('departmentId is invalid or department does not exist', 400);
      }
    }

    const user = await User.create([{
      firstName: pendingUser.firstName,
      lastName: pendingUser.lastName,
      email: pendingUser.email,
      password: pendingUser.password,
      nationalId: pendingUser.nationalId,
      role: pendingUser.role,
      isVerified: true,
      isActive: true,
    }], { session });

    if (pendingUser.role === UserSchema.STUDENT) {
      await StudentProfile.create([{
        userId: user[0]._id,
        academicYear: Number(academicYear),
        departmentId,
        enrolledCourses: [],
      }], { session });
    }

    if (pendingUser.role === UserSchema.INSTRUCTOR) {
      await InstructorProfile.create([{
        userId: user[0]._id,
        departmentId,
        teachingCourses: [],
      }], { session });
    }

    if (pendingUser.role === UserSchema.HOD) {
      await HODProfile.create([{
        userId: user[0]._id,
        departmentId,
      }], { session });
    }

    pendingUser.approvalStatus = 'APPROVED';
    await pendingUser.save({ session, validateBeforeSave: false });
    await PendingUser.deleteOne({ _id: pendingUser._id }, { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: 'success',
      message: 'Pending user approved successfully',
      data: {
        user: {
          id: user[0]._id,
          firstName: user[0].firstName,
          lastName: user[0].lastName,
          email: user[0].email,
          role: user[0].role,
        },
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    next(new AppError(error.message || 'Failed to approve pending user', error.statusCode || 500));
    return;
  }
};

export const getPendingUsersForAdmin = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pendingUsers = await PendingUser.find({
      otpVerified: true,
      approvalStatus: 'PENDING_ADMIN_APPROVAL',
    }).select('-password -otp -otpExpires');

    res.status(200).json({
      status: 'success',
      results: pendingUsers.length,
      data: pendingUsers,
    });
  } catch (error) {
    next(error);
  }
};