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
      message: otp
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

    if (!user.isActive) {
      res.status(403).json({ message: 'Your account is pending admin approval' });
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
    const pendingUser = await PendingUser.findOne({ email }).select('+password');
    if (!pendingUser) {
      throw new AppError('No pending registration found for this email', 404);
    }
    
    // Check OTP
    if (pendingUser.otp !== otp || !pendingUser.otpExpires || Date.now() > pendingUser.otpExpires.getTime()) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    // OTP is valid! Now move to main User collection
    // We set isActive: true but isVerified: true. 
    // They might still need admin approval for roles, but at least they are "in the database"
    const newUser = await User.create({
      firstName: pendingUser.firstName,
      lastName: pendingUser.lastName,
      email: pendingUser.email,
      password: pendingUser.password, // This was already hashed in register
      nationalId: pendingUser.nationalId,
      role: pendingUser.role,
      isVerified: true,
      isActive: false // Users stay inactive until Admin approves them
    });

    // Delete from pending
    await PendingUser.deleteOne({ email });

    const token = generateToken(newUser._id.toString(), newUser.role);

    return res.status(200).json({
      status: 'success',
      message: 'OTP verified successfully. Your account is now in the system and pending admin approval.',
      token,
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role
      }
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

  try {
    const pendingUser = await PendingUser.findById(pendingUserId).select('+password');
    if (!pendingUser) {
      return next(new AppError('Pending user not found', 404));
    }

    if (!pendingUser.otpVerified || pendingUser.approvalStatus !== 'PENDING_ADMIN_APPROVAL') {
      return next(new AppError('Pending user is not ready for admin approval', 400));
    }

    if (pendingUser.role === UserSchema.STUDENT && (academicYear === undefined || !departmentId)) {
      return next(new AppError('academicYear and departmentId are required when approving STUDENT', 400));
    }

    if (
      (pendingUser.role === UserSchema.INSTRUCTOR || pendingUser.role === UserSchema.HOD) &&
      !departmentId
    ) {
      return next(new AppError('departmentId is required when approving INSTRUCTOR/HOD', 400));
    }

    if (departmentId) {
      const department = await Department.findById(departmentId);
      if (!department) {
        return next(new AppError('departmentId is invalid or department does not exist', 400));
      }
    }

    // Step 1: Create the User
    let createdUser: InstanceType<typeof User> | null = null;
    try {
      createdUser = await User.create({
        firstName: pendingUser.firstName,
        lastName: pendingUser.lastName,
        email: pendingUser.email,
        password: pendingUser.password,
        nationalId: pendingUser.nationalId,
        role: pendingUser.role,
        isVerified: true,
        isActive: true,
      });
    } catch (userErr: any) {
      return next(new AppError(userErr.message || 'Failed to create user', 500));
    }

    // Step 2: Create the role-specific profile
    try {
      if (pendingUser.role === UserSchema.STUDENT) {
        await StudentProfile.create({
          userId: createdUser._id,
          academicYear: Number(academicYear),
          departmentId,
          enrolledCourses: [],
        });
      } else if (pendingUser.role === UserSchema.INSTRUCTOR) {
        await InstructorProfile.create({
          userId: createdUser._id,
          departmentId,
          teachingCourses: [],
        });
      } else if (pendingUser.role === UserSchema.HOD) {
        await HODProfile.create({
          userId: createdUser._id,
          departmentId,
        });
      }

      // Step 3: Update pending user status and delete it
      await PendingUser.deleteOne({ _id: pendingUser._id });

    } catch (profileErr: any) {
      // Rollback: remove the user if profile creation fails
      await User.deleteOne({ _id: createdUser._id }).catch(() => {});
      return next(new AppError(profileErr.message || 'Failed to create user profile', 500));
    }

    return res.status(201).json({
      status: 'success',
      message: 'Pending user approved successfully',
      data: {
        user: {
          id: createdUser._id,
          firstName: createdUser.firstName,
          lastName: createdUser.lastName,
          email: createdUser.email,
          role: createdUser.role,
        },
      },
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Failed to approve pending user', error.statusCode || 500));
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

export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { firstName, lastName, email } = req.body;
    let profileImage = req.body.profileImage;
    
    // If a file was uploaded, use its URL
    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      profileImage = `${baseUrl}/uploads/${req.file.filename}`;
    }
    
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (profileImage) user.profileImage = profileImage;

    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profileImage: user.profileImage,
        role: user.role,
        nationalId: user.nationalId,
        isActive: user.isActive,
        createdAt: user.createdAt,
      }
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Error updating profile', 500));
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return next(new AppError('Please provide currentPassword, newPassword and confirmPassword', 400));
    }

    if (newPassword !== confirmPassword) {
      return next(new AppError('New password and confirm password do not match', 400));
    }

    if (newPassword.length < 8) {
      return next(new AppError('New password must be at least 8 characters long', 400));
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const isMatch = await bcryptjs.compare(currentPassword, user.password as string);
    if (!isMatch) {
      return next(new AppError('Current password is incorrect', 401));
    }

    const salt = await bcryptjs.genSalt(10);
    user.password = await bcryptjs.hash(newPassword, salt);
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully'
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Error changing password', 500));
  }
};