import { z } from 'zod';

export const createQuestionSchema = z.object({
  label: z.string().min(3),
  type: z.enum(['short_text', 'long_text', 'linear_scale', 'multiple_choice']),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  order: z.number()
});