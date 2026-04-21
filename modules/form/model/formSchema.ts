// src/models/Form_Schema.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserRole = 'ADMIN' | 'HOD' | 'INSTRUCTOR' | 'STUDENT';


export interface IForm extends Document {
  title: string;
  description?: string;
  creator_id: Types.ObjectId;
  evaluator_roles: UserRole[];
  subject_role: UserRole;
  questions: Types.ObjectId[];
  is_anonymous: boolean;
  is_active: boolean;
  start_date?: Date;
  end_date?: Date;
  department_id?: Types.ObjectId;
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
    required: true
  }],
  
  subject_role: {
    type: String,
    enum: ['ADMIN', 'HOD', 'INSTRUCTOR', 'STUDENT'],
    required: true
  },

  questions: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Question' 
  }],
  
  is_anonymous: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  
  start_date: { type: Date },
  end_date: { type: Date },
  
  department_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'Department' 
  },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing
formSchema.index({ creator_id: 1, department_id: 1 });

const Form = mongoose.model<IForm>('Form', formSchema);
export default Form;