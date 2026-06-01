// src/models/Form_Schema.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserRole = 'DEPARTMENT' | 'COURSE' | 'HOD' | 'INSTRUCTOR' | 'STUDENT';
export type SubjectRole = 'DEPARTMENT' | 'COURSE' | 'INSTRUCTOR' | 'HOD';

export interface IForm extends Document {
  title: string;
  description?: string;
  creator_id: Types.ObjectId;
  evaluator_roles: UserRole[];
  subject_role: SubjectRole;
  questions: Types.ObjectId[];
  is_anonymous: boolean;
  is_active: boolean;
  department_id?: Types.ObjectId;
  category: 'GENERAL' | 'SPECIALIZED' | 'QUIZ';
  course_id?: Types.ObjectId;
  instructor_id?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// 3. بناء الـ Schema
const formSchema = new Schema<IForm>({
  title: {
    type: String,
    required: [true, 'Form title is required'],
    trim: true
  },
  description: { type: String },
  creator_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  evaluator_roles: [{
    type: String,
    enum: ['ADMIN', 'HOD', 'INSTRUCTOR', 'STUDENT'],
    required: function (this: any): boolean {
      // مطلوب فقط لو الفورم متخصصة (تقييم)
      return this.category === 'SPECIALIZED';
    }
  }],

  subject_role: {
    type: String,
    enum: ['DEPARTMENT', 'COURSE', 'INSTRUCTOR', 'HOD'],
    required: function (this: any): boolean {
      // مطلوب فقط لو الفورم متخصصة (تقييم)
      return this.category === 'SPECIALIZED';
    }
  },

  questions: [{
    type: Schema.Types.ObjectId,
    ref: 'Question'
  }],

  is_anonymous: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },



  department_id: {
    type: Schema.Types.ObjectId,
    ref: 'Department',
    required: function (this: any): boolean {
      // إجباري لو بنقيم القسم نفسه، أو كورس جواه، أو رئيس القسم
      return this.category === 'SPECIALIZED' && ['DEPARTMENT', 'COURSE', 'HOD'].includes(this.subject_role);
    }
  },
  category: {
    type: String,
    enum: ['GENERAL', 'SPECIALIZED', 'QUIZ'],
    default: 'GENERAL',
    required: true
  },
  course_id: {
    type: Schema.Types.ObjectId,
    ref: 'Course',
    required: function (this: any): boolean {
      // إجباري فقط لو بنقيم كورس
      return this.category === 'SPECIALIZED' && this.subject_role === 'COURSE';
    }
  },
  instructor_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: function (this: any): boolean {
      // إجباري فقط لو بنقيم دكتور بعينه
      return this.category === 'SPECIALIZED' && this.subject_role === 'INSTRUCTOR';
    }
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing

formSchema.index(
  { title: 1, creator_id: 1, department_id: 1 },
  { unique: true }
);

const Form = mongoose.model<IForm>('Form', formSchema);
export default Form;