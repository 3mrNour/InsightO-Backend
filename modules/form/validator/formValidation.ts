// // src/validations/formValidation.ts
// import { z } from 'zod';

// export const createFormSchema = z.object({
//   body: z.object({
//     title: z.string().min(5, "Title must be at least 5 characters"),
//     description: z.string().optional(),

//     evaluator_roles: z.array(
//       z.enum(['ADMIN', 'HOD', 'INSTRUCTOR', 'STUDENT'])
//     ).min(1, "Select at least one evaluator role"),
    
   
//     subject_role: z.enum(['ADMIN', 'HOD', 'INSTRUCTOR', 'STUDENT'], {
//       message: "Subject role is required"
//     }),
    
//     is_anonymous: z.boolean().default(false),
//     is_active: z.boolean().default(true),
    
//     department_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID").optional()
//     // Add other fields here as needed
//   })
// });

import { z } from "zod";

// helper
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

const rolesEnum = z.enum(["ADMIN", "HOD", "INSTRUCTOR", "STUDENT"]);

export const createFormSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(5, "Title must be at least 5 chars")
      .max(100, "Max 100 chars")
      .trim(),

    description: z
      .string()
      .max(500, "Max 500 chars")
      .trim()
      .optional(),

    evaluator_roles: z
      .array(rolesEnum)
      .min(1, "At least one evaluator role required")
      .refine((roles) => new Set(roles).size === roles.length, {
        message: "Duplicate roles are not allowed"
      }),

    subject_role: rolesEnum,

    is_anonymous: z.boolean().optional().default(false),
    is_active: z.boolean().optional().default(true),

    department_id: objectId.optional()
  })
  .refine((data) => {
    // 🚨 Business rule: evaluator != subject
    return !data.evaluator_roles.includes(data.subject_role);
  }, {
    message: "Evaluator role cannot be same as subject role",
    path: ["subject_role"]
  })
});