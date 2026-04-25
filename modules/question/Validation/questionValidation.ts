import { z } from "zod";

const questionTypes = z.enum([
  "short_text",
  "long_text",
  "linear_scale",
  "multiple_choice"
]);

export const createQuestionSchema = z.object({
  body: z.object({
    label: z.string().min(3).max(200).trim(),

    type: questionTypes,

    required: z.boolean().optional().default(false),

    options: z.array(z.string().min(1).trim())
      .optional(),

    scale: z.object({
      min: z.number().min(1).max(10),
      max: z.number().min(1).max(10)
    }).optional(),

    order: z.number().min(1)
  })
  .superRefine((data, ctx) => {
    // 🎯 multiple_choice لازم options
    if (data.type === "multiple_choice") {
      if (!data.options || data.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Multiple choice requires at least 2 options",
          path: ["options"]
        });
      }
    }

    // 🎯 باقي الأنواع ممنوع options
    if (data.type !== "multiple_choice" && data.options) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Options only allowed for multiple_choice",
        path: ["options"]
      });
    }

    // 🎯 linear scale validation
    if (data.type === "linear_scale") {
      if (!data.scale) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Scale required for linear scale",
          path: ["scale"]
        });
      } else if (data.scale.min >= data.scale.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Min must be less than max",
          path: ["scale"]
        });
      }
    }
  })
});

export const formIdParamSchema = z.object({
  params: z.object({
    formId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Form ID")
  })
});

export const questionIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Question ID")
  })
});

export const reorderSchema = z.object({
  body: z.array(
    z.object({
      id: z.string().regex(/^[0-9a-fA-F]{24}$/),
      order: z.number().min(1)
    })
  ).min(1)
});
