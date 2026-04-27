// src/modules/submission/submission.model.ts

import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Submission Interface
 * Records a student's (evaluator) answers for a specific form.
 */
export interface ISubmission extends Document {
  form_id: Types.ObjectId;
  evaluator_id: Types.ObjectId; // The student submitting the form
  subject_id: Types.ObjectId;   // The instructor/subject being evaluated
  answers: {
    question_id: Types.ObjectId;
    value: any; // Dynamic value based on question type
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const submissionSchema = new Schema<ISubmission>(
  {
    form_id: {
      type: Schema.Types.ObjectId,
      ref: 'Form',
      required: true,
    },

    evaluator_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    subject_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    answers: [
      {
        question_id: {
          type: Schema.Types.ObjectId,
          ref: 'Question',
          required: true,
        },
        value: {
          type: Schema.Types.Mixed, // Allows strings, numbers, arrays, or objects
          required: true,
        },
      },
    ],
  },
  { timestamps: true },
);

/**
 * Prevent duplicate submissions.
 * Each student (evaluator) can submit a specific form only once.
 */
submissionSchema.index({ form_id: 1, evaluator_id: 1 }, { unique: true });

export default mongoose.model<ISubmission>('Submission', submissionSchema);
