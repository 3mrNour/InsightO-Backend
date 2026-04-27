// models/PendingUser.ts
import mongoose, { Document, Schema } from 'mongoose';
import { UserSchema } from '../../../utils/User.js';

export interface IPendingUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  nationalId: number;
  role: string;
  otp: string;
  otpExpires: Date;
  otpVerified: boolean;
  approvalStatus: 'PENDING_OTP' | 'PENDING_ADMIN_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdAt?: Date;
}

const pendingUserSchema = new mongoose.Schema<IPendingUser>({
  // حقول اليوزر الأساسية (نفس الأنواع في السكيما بتاعتك)
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 8, select: false },
  nationalId: { type: Number, unique: true, required: true },
  role: {
    type: String,
    enum: [UserSchema.ADMIN, UserSchema.HOD, UserSchema.INSTRUCTOR, UserSchema.STUDENT],
    required: true
  },

  // حقول التحقق (OTP)
  otp: { type: String, required: true },
  otpExpires: { type: Date, required: true },
  otpVerified: { type: Boolean, default: false },
  approvalStatus: {
    type: String,
    enum: ['PENDING_OTP', 'PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED'],
    default: 'PENDING_OTP',
  },

  // حقل التدمير الذاتي (بيتمسح بعد 10 دقائق لو متمش التفعيل)
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const PendingUser = mongoose.models.PendingUser || mongoose.model<IPendingUser>('PendingUser', pendingUserSchema);

export default PendingUser;