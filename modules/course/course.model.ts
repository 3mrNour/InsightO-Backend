// src/modules/course/course.model.ts

import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ICourse extends Document {
  name: string;
  courseCode: string;
  description?: string;
  departmentId: Types.ObjectId;
  instructorId: Types.ObjectId;
  credits?: number;
  isActive: boolean;
}

const courseSchema = new Schema<ICourse>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    courseCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // لتوحيد الصيغة دايماً (مثل NODE-101)
    },
    description: {
      type: String,
      trim: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true, // هنا بنعتمد على القسم كبديل للـ Track
    },
    instructorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    credits: {
      type: Number,
      min: 1,
      max: 10,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const Course =
  mongoose.models.Course || mongoose.model<ICourse>("Course", courseSchema);

export default Course;
