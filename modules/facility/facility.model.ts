import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFacility extends Document {
  name: string;
  description?: string;
  category?: string;
  managed_by?: Types.ObjectId;
  created_by: Types.ObjectId;
  ai_evaluation_synthesis?: any;
  ai_evaluation_count?: number;
  ai_evaluation_updated_at?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const facilitySchema = new Schema<IFacility>({
  name: {
    type: String,
    required: [true, 'Facility name is required'],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    enum: ['Service', 'Infrastructure', 'Event', 'Other'],
    default: 'Other',
  },
  managed_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  ai_evaluation_synthesis: {
    type: Schema.Types.Mixed,
    default: null,
  },
  ai_evaluation_count: {
    type: Number,
    default: 0,
  },
  ai_evaluation_updated_at: {
    type: Date,
    default: null,
  }
}, {
  timestamps: true,
});

const Facility = mongoose.model<IFacility>('Facility', facilitySchema);
export default Facility;
