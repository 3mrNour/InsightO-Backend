import type { NextFunction, Request, Response } from 'express';
import User from '../modules/auth/model/User_Schema.js';
import sendEmail from '../utils/Email.js';

const OTP_EXPIRY_MS = 60 * 1000;

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

export const sendOtpForUser = (subject: string, introMessage: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as Request & { otpUserId?: string }).otpUserId;
      const user = userId
        ? await User.findById(userId)
        : await User.findOne({ email: req.body?.email });

      if (!user) {
        return res.status(404).json({ status: 'fail', message: "Your email isn't registered with us" });
      }

      const otp = generateOtp();
      user.otp = otp;
      user.otpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
      await user.save({ validateBeforeSave: false });

      try {
        await sendEmail({
          email: user.email,
          subject,
          message: `${introMessage} ${otp}`
        });
      } catch (err) {
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return res.status(500).json({
          status: 'error',
          message: 'There was an error sending the email, please try again'
        });
      }

      return next();
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  };
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ status: 'fail', message: 'email and otp are required' });
    }

    const user = await User.findOne({ email }).select('+otp +otpExpires');
    const isOtpExpired = !user?.otpExpires || Date.now() > user.otpExpires.getTime();

    if (!user || user.otp !== otp || isOtpExpired) {
      return res.status(400).json({ status: 'fail', message: 'Invalid or expired OTP' });
    }

    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });

    (req as Request & { otpUserId?: string }).otpUserId = user._id.toString();
    return next();
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};
