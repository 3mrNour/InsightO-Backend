// src/models/Question_Schema.ts

import mongoose, { Schema, Document, Types } from 'mongoose';

export type QuestionType = 
  | 'short_text'
  | 'long_text'
  | 'linear_scale'
  | 'multiple_choice';

export interface IQuestion extends Document {
  form_id: Types.ObjectId;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  order: number;
  
}

const questionSchema = new Schema<IQuestion>({
  form_id: {
    type: Schema.Types.ObjectId,
    ref: 'Form',
    required: true
  },

  label: {
    type: String,
    required: true
  },

  type: {
    type: String,
    enum: ['short_text', 'long_text', 'linear_scale', 'multiple_choice'],
    required: true
  },

  required: {
    type: Boolean,
    default: false
  },

  options: {
    type: [String],
    default: []
  },

  order: {
    type: Number,
    required: true
  },

 

}, { timestamps: true });

questionSchema.index(
  { form_id: 1, order: 1 },
  { unique: true }
);

export default mongoose.model<IQuestion>('Question', questionSchema);