import mongoose, { type Document, type Types } from "mongoose";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ITokenUsage extends Document {
  userId: Types.ObjectId;
  role: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  createdAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const tokenUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
    },
    feature: {
      type: String,
      required: true,
    },
    inputTokens: {
      type: Number,
      required: true,
      default: 0,
    },
    outputTokens: {
      type: Number,
      required: true,
      default: 0,
    },
    totalTokens: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true, // auto createdAt + updatedAt
  }
);

// ─── Compound index for fast aggregation queries ──────────────────────────────
tokenUsageSchema.index({ userId: 1, createdAt: -1 });

const TokenUsage =
  mongoose.models.TokenUsage ||
  mongoose.model<ITokenUsage>("TokenUsage", tokenUsageSchema);

export default TokenUsage;
