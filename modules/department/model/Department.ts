import mongoose, { Schema, type Document } from "mongoose";

export interface IDepartment extends Document {
  name: string;
  code: string;
  description?: string;
  ai_evaluation_synthesis?: any;
  ai_evaluation_count?: number;
  ai_evaluation_updated_at?: Date;
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
    ai_evaluation_synthesis: { type: Schema.Types.Mixed, default: null },
    ai_evaluation_count: { type: Number, default: 0 },
    ai_evaluation_updated_at: { type: Date, default: null },
  },
  { timestamps: true },
);

const Department =
  mongoose.models.Department ||
  mongoose.model<IDepartment>("Department", departmentSchema);

export default Department;
