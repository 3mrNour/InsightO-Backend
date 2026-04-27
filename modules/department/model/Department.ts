import mongoose, { Schema, type Document } from "mongoose";

export interface IDepartment extends Document {
  name: string;
  code: string;
  description?: string;
}

const departmentSchema = new Schema<IDepartment>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

const Department =
  mongoose.models.Department ||
  mongoose.model<IDepartment>("Department", departmentSchema);

export default Department;
