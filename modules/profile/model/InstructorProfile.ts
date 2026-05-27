import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IInstructorProfile extends Document {
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  teachingCourses: Types.ObjectId[];
  ai_synthesis?: any;
  ai_synthesis_task_count?: number;
  ai_synthesis_updated_at?: Date;
}

const instructorProfileSchema = new Schema<IInstructorProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    teachingCourses: [
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

const InstructorProfile =
  mongoose.models.InstructorProfile ||
  mongoose.model<IInstructorProfile>("InstructorProfile", instructorProfileSchema);

export default InstructorProfile;
