import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IHODProfile extends Document {
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  ai_synthesis?: any;
  ai_synthesis_task_count?: number;
  ai_synthesis_updated_at?: Date;
}

const hodProfileSchema = new Schema<IHODProfile>(
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
    ai_synthesis: { type: Schema.Types.Mixed, default: null },
    ai_synthesis_task_count: { type: Number, default: 0 },
    ai_synthesis_updated_at: { type: Date, default: null },
  },
  { timestamps: true },
);

const HODProfile =
  mongoose.models.HODProfile ||
  mongoose.model<IHODProfile>("HODProfile", hodProfileSchema);

export default HODProfile;
