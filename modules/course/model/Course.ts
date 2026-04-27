import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ICourse extends Document {
  name: string;
  courseCode: string;
  departmentId: Types.ObjectId;
  instructorId: Types.ObjectId;
  credits?: number;
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
      unique: true,
      trim: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    instructorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    credits: {
      type: Number,
    },
  },
  { timestamps: true },
);

const Course = mongoose.models.Course || mongoose.model<ICourse>("Course", courseSchema);

export default Course;
