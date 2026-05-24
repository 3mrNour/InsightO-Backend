import mongoose, { Schema, Document } from 'mongoose';

export interface IChunk extends Document {
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

const ChunkSchema = new Schema<IChunk>({
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
  taskId: { type: String },
  submissionId: { type: String },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true, strict: false });

export const Chunk = mongoose.models.Chunk || mongoose.model<IChunk>('Chunk', ChunkSchema);
