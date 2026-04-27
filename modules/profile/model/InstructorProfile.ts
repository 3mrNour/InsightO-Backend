import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IInstructorProfile extends Document {
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  teachingCourses: Types.ObjectId[];
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
  },
  { timestamps: true },
);

const InstructorProfile =
  mongoose.models.InstructorProfile ||
  mongoose.model<IInstructorProfile>("InstructorProfile", instructorProfileSchema);

export default InstructorProfile;
