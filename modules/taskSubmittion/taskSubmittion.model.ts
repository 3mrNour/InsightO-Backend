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
  form_answers?: {
    question_id: Types.ObjectId;
    value: any;
  }[];
  ai_evaluation?: {
    suggested_grade?: number;
    feedback?: string;
    confidence_score?: number;
    weaknesses?: string[];
    recommendations?: string[];
    criteria_breakdown?: {
      criterion: string;
      score: number;
      max: number;
      comments: string;
    }[];
    concept_mastery?: {
      concept: string;
      mastery_level: number;
      status: 'EXCELLENT' | 'GOOD' | 'CRITICAL';
    }[];
    quality_metrics?: {
      readability: number;
      complexity_score: number;
      security_guardrails: number;
    };
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
    form_answers: [
      {
        question_id: { type: Schema.Types.ObjectId, ref: 'Question' },
        value: { type: Schema.Types.Mixed }
      }
    ],
    ai_evaluation: {
      suggested_grade: { type: Number },
      feedback: { type: String },
      confidence_score: { type: Number },
      weaknesses: [{ type: String }],
      recommendations: [{ type: String }],
      criteria_breakdown: [{
        criterion: { type: String },
        score: { type: Number },
        max: { type: Number },
        comments: { type: String }
      }],
      concept_mastery: [{
        concept: { type: String },
        mastery_level: { type: Number },
        status: { type: String, enum: ['EXCELLENT', 'GOOD', 'CRITICAL'] }
      }],
      quality_metrics: {
        readability: { type: Number },
        complexity_score: { type: Number },
        security_guardrails: { type: Number }
      }
    },
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

taskSubmissionSchema.index({ task_id: 1, submitter_id: 1 }, { unique: true });

const TaskSubmission = mongoose.models.TaskSubmission || mongoose.model<ITaskSubmission>("TaskSubmission", taskSubmissionSchema);

export default TaskSubmission;