// models/PendingUser.ts
import mongoose, { Document, Schema } from 'mongoose';
import { UserSchema } from '../../../utils/User.js';

export interface IPendingUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: number;
  address?: string;
  nationalId: number;
  role: string;
  departmentId?: Schema.Types.ObjectId;
  academicYear?: number;
  otp: string;
  otpExpires: Date;
  createdAt?: Date;
}

const pendingUserSchema = new mongoose.Schema<IPendingUser>({
  // حقول اليوزر الأساسية (نفس الأنواع في السكيما بتاعتك)
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 8, select: false },
  phone: { type: Number },
  address: { type: String },
  nationalId: { type: Number, unique: true, required: true },
  role: {
    type: String,
    enum: [UserSchema.ADMIN, UserSchema.HEAD_OF_DEP, UserSchema.INSTRUCTOR, UserSchema.STUDENT],
    required: true
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: false
  },
  academicYear: {
    type: Number,
    required: false
  },

  // حقول التحقق (OTP)
  otp: { type: String, required: true },
  otpExpires: { type: Date, required: true },

  // حقل التدمير الذاتي (بيتمسح بعد 10 دقائق لو متمش التفعيل)
  createdAt: { type: Date, default: Date.now, expires: 600 }
}, { timestamps: true });

const PendingUser = mongoose.models.PendingUser || mongoose.model<IPendingUser>('PendingUser', pendingUserSchema);

export default PendingUser;