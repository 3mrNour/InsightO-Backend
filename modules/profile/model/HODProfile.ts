import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IHODProfile extends Document {
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
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
  },
  { timestamps: true },
);

const HODProfile =
  mongoose.models.HODProfile ||
  mongoose.model<IHODProfile>("HODProfile", hodProfileSchema);

export default HODProfile;
