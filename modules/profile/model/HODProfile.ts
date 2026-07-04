import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IHODProfile extends Document {
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  departmentIds: Types.ObjectId[];
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
    // Array version — supports multiple departments per HOD
    departmentIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Department" }],
      default: [],
    },
    ai_synthesis: { type: Schema.Types.Mixed, default: null },
    ai_synthesis_task_count: { type: Number, default: 0 },
    ai_synthesis_updated_at: { type: Date, default: null },
  },
  { timestamps: true },
);

/**
 * Pre-save hook: keep departmentIds in sync with departmentId.
 * If departmentIds is empty, seed it from the legacy departmentId field.
 */
hodProfileSchema.pre("save", function (next) {
  if (!this.departmentIds || this.departmentIds.length === 0) {
    if (this.departmentId) {
      this.departmentIds = [this.departmentId];
    }
  }
  next();
});

const HODProfile =
  mongoose.models.HODProfile ||
  mongoose.model<IHODProfile>("HODProfile", hodProfileSchema);

export default HODProfile;
