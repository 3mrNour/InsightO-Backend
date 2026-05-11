// src/modules/submission/submission.model.ts

import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ITaskSubmission extends Document {
  task_id: Types.ObjectId;
  submitter_id: Types.ObjectId;
  content?: string;
  attachments?: {
    url: string;
    fileName?: string;
    size?: number;
  }[];
  ai_evaluation?: {
    suggested_grade?: number;
    feedback?: string;
    confidence_score?: number;
  };
  final_grade?: number;
  instructor_feedback?: string;
  status: 'SUBMITTED' | 'AI_GRADED' | 'FINALIZED';
}

const taskSubmissionSchema = new Schema<ITaskSubmission>(
  {
    task_id: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    submitter_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String },
    attachments: [
      {
        url: { type: String, required: true },
        fileName: { type: String },
        size: { type: Number },
      },
    ],
    // 🤖 حقول مجهزة لخطوة الذكاء الاصطناعي القادمة
    ai_evaluation: {
      suggested_grade: { type: Number },
      feedback: { type: String },
      confidence_score: { type: Number },
    },
    // 👨‍🏫 التقييم البشري
    final_grade: { type: Number },
    instructor_feedback: { type: String },
    status: {
      type: String,
      enum: ['SUBMITTED', 'AI_GRADED', 'FINALIZED'],
      default: 'SUBMITTED',
    },
  },
  { timestamps: true }
);

// منع تكرار التسليم لنفس الطالب في نفس التاسك
taskSubmissionSchema.index({ task_id: 1, submitter_id: 1 }, { unique: true });

const TaskSubmission = mongoose.models.TaskSubmission || mongoose.model<ITaskSubmission>("TaskSubmission", taskSubmissionSchema);

export default TaskSubmission;