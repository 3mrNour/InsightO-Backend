import { z } from "zod";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

const questionTypes = z.enum([
  "short_text",
  "long_text",
  "linear_scale",
  "multiple_choice",
  "file"
]);

// ─── Scale Schema ──────────────────────────────────────────────────────────────

const scaleSchema = z.object({
  min: z.number().int().min(1).max(10, "Min must be between 1-10"),
  max: z.number().int().min(1).max(10, "Max must be between 1-10")
}).refine((data) => data.min < data.max, {
  message: "Min must be less than max",
  path: ["min"]
});

// ─── File Config Schema ────────────────────────────────────────────────────────

const fileConfigSchema = z.object({
  allowed_types: z.array(z.string()).min(1, "At least one file type required"),
  max_size: z.number().int().positive("Max size must be positive")
});

// ─── Create Question Schema ────────────────────────────────────────────────────

export const createQuestionSchema = z.object({
  body: z.object({
    label: z
      .string()
      .min(3, "Label must be at least 3 chars")
      .max(200, "Max 200 chars")
      .trim(),

    type: questionTypes,

    required: z.boolean().optional().default(false),

    options: z.array(z.string().min(1).trim())
      .optional(),

    scale: scaleSchema.optional(),

    file_config: fileConfigSchema.optional(),

    ai_tag: z.string().optional(),

    order: z.number().int().min(1, "Order must be at least 1")
  })
    .superRefine((data, ctx) => {
      // 🎯 multiple_choice requires options
      if (data.type === "multiple_choice") {
        if (!data.options || data.options.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Multiple choice requires at least 2 options",
            path: ["options"]
          });
        }
      }

      // 🎯 Other types cannot have options
      if (data.type !== "multiple_choice" && data.options) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Options only allowed for multiple_choice",
          path: ["options"]
        });
      }

      // 🎯 linear_scale requires scale
      if (data.type === "linear_scale") {
        if (!data.scale) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Scale configuration required for linear_scale",
            path: ["scale"]
          });
        }
      } else if (data.scale) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Scale only allowed for linear_scale",
          path: ["scale"]
        });
      }

      // 🎯 file type requires file_config
      if (data.type === "file") {
        if (!data.file_config) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "File config required for file type",
            path: ["file_config"]
          });
        }
      } else if (data.file_config) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "File config only allowed for file type",
          path: ["file_config"]
        });
      }
    })
});

// ─── Param Schemas ────────────────────────────────────────────────────────────

export const formIdParamSchema = z.object({
  params: z.object({
    formId: objectId
  })
});

export const questionIdParamSchema = z.object({
  params: z.object({
    id: objectId
  })
});

// ─── Reorder Schema ───────────────────────────────────────────────────────────

export const reorderSchema = z.object({
  body: z.array(
    z.object({
      id: objectId,
      order: z.number().int().min(1)
    })
  ).min(1, "At least one question required")
});
