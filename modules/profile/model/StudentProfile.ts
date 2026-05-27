import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IStudentProfile extends Document {
  userId: Types.ObjectId;
  academicYear: number;
  departmentId: Types.ObjectId;
  enrolledCourses: Types.ObjectId[];
  ai_synthesis?: any;
  ai_synthesis_task_count?: number;
  ai_synthesis_updated_at?: Date;
}

const studentProfileSchema = new Schema<IStudentProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    academicYear: {
      type: Number,
      required: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    enrolledCourses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    ai_synthesis: { type: Schema.Types.Mixed, default: null },
    ai_synthesis_task_count: { type: Number, default: 0 },
    ai_synthesis_updated_at: { type: Date, default: null },
  },
  { timestamps: true },
);

const StudentProfile =
  mongoose.models.StudentProfile ||
  mongoose.model<IStudentProfile>("StudentProfile", studentProfileSchema);

export default StudentProfile;
