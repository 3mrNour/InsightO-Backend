import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IStudentProfile extends Document {
  userId: Types.ObjectId;
  academicYear: number;
  departmentId: Types.ObjectId;
  enrolledCourses: Types.ObjectId[];
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
  },
  { timestamps: true },
);

const StudentProfile =
  mongoose.models.StudentProfile ||
  mongoose.model<IStudentProfile>("StudentProfile", studentProfileSchema);

export default StudentProfile;
