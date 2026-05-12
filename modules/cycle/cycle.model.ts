import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICycle extends Document {
  name: string;
  description?: string;
  formId: Types.ObjectId;
  targetDepartmentIds: Types.ObjectId[];
  evaluatorRoles: string[];
  startDate: Date;
  endDate: Date;
  status: "DRAFT" | "UPCOMING" | "ACTIVE" | "COMPLETED";
  participantsCount: number;
  completionRate: number;
  creatorId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const cycleSchema = new Schema<ICycle>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    formId: { type: Schema.Types.ObjectId, ref: "Form", required: true },
    targetDepartmentIds: [{ type: Schema.Types.ObjectId, ref: "Department" }],
    evaluatorRoles: [{ type: String, enum: ["ADMIN", "HOD", "INSTRUCTOR", "STUDENT"] }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { 
      type: String, 
      enum: ["DRAFT", "UPCOMING", "ACTIVE", "COMPLETED"],
      default: "UPCOMING"
    },
    participantsCount: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model<ICycle>("Cycle", cycleSchema);
