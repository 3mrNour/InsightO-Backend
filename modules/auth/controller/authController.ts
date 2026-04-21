import type { NextFunction, Request, Response } from 'express';
import User from '../model/User_Schema.js';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';

const generateToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d'
  });
};


// Register Controller

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, email, password, role, nationalId, departmentId, academicYear } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ message: 'Email is already registered' });
      return;
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: role || 'STUDENT',
      nationalId,
      departmentId,
      academicYear,
      isVerified: false
    });

    (req as Request & { otpUserId?: string; otpEmail?: string }).otpUserId = user._id.toString();
    (req as Request & { otpUserId?: string; otpEmail?: string }).otpEmail = user.email;
    return next();

  } catch (error: any) {
    res.status(500).json({ message: 'Server error during registration', error: error.message });
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
  user.confirmPassword = confirmPassword; 
  
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Congratulations! Your password has been changed successfully, you can now log in'
  });
};