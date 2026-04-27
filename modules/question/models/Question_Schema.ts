// src/modules/question/models/Question_Schema.ts

import mongoose, { Schema, Document, Types } from "mongoose";

// ─── Question Types ───────────────────────────────────────────────────────────

export type QuestionType =
  | "short_text"
  | "long_text"
  | "linear_scale"
  | "multiple_choice"
  | "file";

// ─── File Config Interface ────────────────────────────────────────────────────

export interface IFileConfig {
  allowed_types: string[];
  max_size: number;
}

// ─── Question Interface ───────────────────────────────────────────────────────

export interface IQuestion extends Document {
  form_id: Types.ObjectId;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  order: number;
  file_config?: IFileConfig;
}

// ─── Sub-Schema for File Config ───────────────────────────────────────────────

const fileConfigSchema = new Schema<IFileConfig>(
  {
    allowed_types: {
      type: [String],
      default: ["image/png", "image/jpeg", "application/pdf"],
    },
    max_size: {
      type: Number,
      default: 5 * 1024 * 1024, // 5 MB
    },
  },
  { _id: false }
);

// ─── Main Question Schema ──────────────────────────────────────────────────────

const questionSchema = new Schema<IQuestion>(
  {
    form_id: {
      type: Schema.Types.ObjectId,
      ref: "Form",
      required: true,
    },

    label: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["short_text", "long_text", "linear_scale", "multiple_choice", "file"],
      required: true,
    },

    required: {
      type: Boolean,
      default: false,
    },

    options: {
      type: [String],
      default: [],
    },

    order: {
      type: Number,
      required: true,
    },

    file_config: {
      type: fileConfigSchema,
      required: false,
    },
  },
  { 
    timestamps: true,
    // Ensure virtuals etc. are handled correctly
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Ensure questions are uniquely ordered within a single form
questionSchema.index({ form_id: 1, order: 1 }, { unique: true });

export default mongoose.model<IQuestion>("Question", questionSchema);