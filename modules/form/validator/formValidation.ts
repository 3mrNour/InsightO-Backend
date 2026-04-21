// src/validations/formValidation.ts
import { z } from 'zod';

export const createFormSchema = z.object({
  body: z.object({
    title: z.string().min(5, "Title must be at least 5 characters"),
    description: z.string().optional(),

    evaluator_roles: z.array(
      z.enum(['ADMIN', 'HOD', 'INSTRUCTOR', 'STUDENT'])
    ).min(1, "Select at least one evaluator role"),
    
   
    subject_role: z.enum(['ADMIN', 'HOD', 'INSTRUCTOR', 'STUDENT'], {
      message: "Subject role is required"
    }),
    
    is_anonymous: z.boolean().default(false),
    is_active: z.boolean().default(true),
    
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    
    department_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID").optional(),
  }).refine((data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) > new Date(data.start_date);
    }
    return true;
  }, {
    message: "End date must be after start date",
    path: ["end_date"]
  })
});