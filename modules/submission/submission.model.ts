// src/modules/submission/submission.model.ts

import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Submission Interface
 * Records a student's (evaluator) answers for a specific form.
 */
export interface ISubmission extends Document {
  form_id: Types.ObjectId;
  evaluator_id?: Types.ObjectId; // The student submitting the form
  subject_id?: Types.ObjectId;   // The instructor/subject being evaluated
  task_id?: Types.ObjectId;
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

    task_id: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
    },

    evaluator_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined, // 👈 إجبار الـ Object لو مش مبعوت ينزل undefined مش null
    },

    subject_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined, // 👈 إجبار الـ Object لو مش مبعوت ينزل undefined مش null
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

// ─── الـ Index الذكي والمصحح ──────────────────────────────────────────────────
submissionSchema.index(
  { form_id: 1, evaluator_id: 1, subject_id: 1 },
  { 
    unique: true, 
    name: 'form_evaluator_subject_unique',
    // الفلترة هنا مبنية على التأكد التام إن الحقول دي نوعها مقيد بـ ObjectId حقيقي فقط
    partialFilterExpression: {
      evaluator_id: { $type: "objectId" },
      subject_id: { $type: "objectId" }
    }
  }
);

// ─── تنظيف وحذف الـ Indexes القديمة أوتوماتيكياً لمنع الـ Collisions ───────────
submissionSchema.on('init', async (model: mongoose.Model<ISubmission>) => {
  try {
    const indexes = await model.collection.indexes();

    // 1. حذف الـ Index القديم خالص (لو موجود)
    if (indexes.find((index) => index.name === 'form_id_1_evaluator_id_1')) {
      try {
        await model.collection.dropIndex('form_id_1_evaluator_id_1');
        console.log('🧹 Old index form_id_1_evaluator_id_1 dropped');
      } catch (err: any) {
        if (err.codeName === "IndexNotFound") {
          console.log('⚠️ form_id_1_evaluator_id_1 already removed');
        } else {
          throw err;
        }
      }
    }

    // 2. حذف الـ unique index القديم (لو موجود)
    const existingUniqueIndex = indexes.find(
      (index) => index.name === 'form_evaluator_subject_unique'
    );

    if (existingUniqueIndex) {
      try {
        await model.collection.dropIndex('form_evaluator_subject_unique');
        console.log('🔄 Old unique index dropped to apply new partial filter expressions.');
      } catch (err: any) {
        if (err.codeName === "IndexNotFound") {
          console.log('⚠️ form_evaluator_subject_unique already removed');
        } else {
          throw err;
        }
      }
    }
  } catch (error) {
    console.log('⚠️ Index synchronization log:', error);
  }
});

export default mongoose.model<ISubmission>('Submission', submissionSchema);