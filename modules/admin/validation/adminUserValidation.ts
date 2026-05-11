import { z } from 'zod';
import { UserSchema } from '../../../utils/User.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

const baseAdminUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").trim(),
  lastName: z.string().min(1, "Last name is required").trim(),
  email: z.string().email("Invalid email").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  nationalId: z.number().int().positive("National ID must be a valid positive integer"),
});

// Using discriminated union to enforce conditional validation based on the role
export const createAdminUserSchema = z.object({
  body: z.discriminatedUnion("role", [
    baseAdminUserSchema.extend({
      role: z.literal(UserSchema.STUDENT),
      departmentId: objectId,
      academicYear: z.number().int().positive("Academic Year is required for STUDENTS"),
    }),
    baseAdminUserSchema.extend({
      role: z.literal(UserSchema.INSTRUCTOR),
      departmentId: objectId,
    }),
    baseAdminUserSchema.extend({
      role: z.literal(UserSchema.HOD),
      departmentId: objectId,
    }),
    baseAdminUserSchema.extend({
      role: z.literal(UserSchema.ADMIN),
    }),
  ])
});
