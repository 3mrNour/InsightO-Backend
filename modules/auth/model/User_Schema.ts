import mongoose from 'mongoose';

import {UserSchema} from '../../../utils/User.js'

const user_Schema = new mongoose.Schema({
  
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 8, select: false },
  nationalId: { type: Number, unique: true, required: true },
  profileImage: { type: String, default: '' },
  
  role: {
    type: String,
    enum: [UserSchema.ADMIN, UserSchema.HOD, UserSchema.INSTRUCTOR, UserSchema.STUDENT],
    required: true
  },

  isActive: { type: Boolean, default: true },

  
  isVerified: { type: Boolean, default: false },

  otp: {
    type: String,
    select: false
  },
  otpExpires: {
    type: Date,
    select: false
  }

}, 
{ timestamps: true });


const User = mongoose.models.User || mongoose.model('User', user_Schema);

export default User;