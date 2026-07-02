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

const evaluatorRolesEnum = z.enum(["ADMIN", "HOD", "INSTRUCTOR", "STUDENT", "GENERAL"]);
const subjectRolesEnum = z.enum(["ADMIN", "HOD", "INSTRUCTOR", "STUDENT", "DEPARTMENT", "COURSE", "FACILITY"]);

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

    evaluator_roles: z.array(evaluatorRolesEnum).optional(),
    subject_role: subjectRolesEnum.optional(),

    is_anonymous: z.boolean().optional().default(false),
    is_active: z.boolean().optional().default(true),

    department_id: objectId.optional(),
    category: z.enum(["GENERAL", "SPECIALIZED", "QUIZ"]).optional().default("GENERAL"),
    course_id: objectId.optional(),
    instructor_id: objectId.optional(),
    facility_id: objectId.optional()
  })
  .superRefine((data, ctx) => {
    if (data.category !== "QUIZ") {
      // 🚨 Business rules for forms (non-quiz)
      if (!data.evaluator_roles || data.evaluator_roles.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one evaluator role required",
          path: ["evaluator_roles"]
        });
      } else if (new Set(data.evaluator_roles).size !== data.evaluator_roles.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate roles are not allowed",
          path: ["evaluator_roles"]
        });
      }
      
      if (!data.subject_role) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Subject role is required",
          path: ["subject_role"]
        });
      } else if (data.evaluator_roles && data.evaluator_roles.includes(data.subject_role as any)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Evaluator role cannot be same as subject role",
          path: ["subject_role"]
        });
      }
    }
  })
});