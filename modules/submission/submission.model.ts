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
 * Each evaluator can submit once per (form, subject) pair.
 */
submissionSchema.index(
  { form_id: 1, evaluator_id: 1, subject_id: 1 },
  { unique: true, name: 'form_evaluator_subject_unique' },
);

// Backward-compat cleanup: remove the old two-field unique index if present.
submissionSchema.on('init', async (model: mongoose.Model<ISubmission>) => {
  try {
    const indexes = await model.collection.indexes();
    const legacyIndex = indexes.find((index) => index.name === 'form_id_1_evaluator_id_1');
    if (legacyIndex) {
      await model.collection.dropIndex('form_id_1_evaluator_id_1');
    }
  } catch {
    // Ignore index cleanup failures; schema index creation still proceeds.
  }
});

export default mongoose.model<ISubmission>('Submission', submissionSchema);
