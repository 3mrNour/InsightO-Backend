import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Task Interface
 */
export interface ITask extends Document {
  title: string;
  description: string;
  creator_id: Types.ObjectId;
  target: {
    department_id?: Types.ObjectId;
    course_id?: Types.ObjectId;
    specific_users?: Types.ObjectId[];
  };
  attachments?: {
    url: string;
    fileName?: string;
    size?: number;
  }[];
  ai_grading_rubric?: string;
  deadline: Date;
  status: "ACTIVE" | "CLOSED";
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    // مين اللي عمل التاسك (ADMIN, HOD, INSTRUCTOR)
    creator_id: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // التاسك ده رايح لمين؟ (بنخليه مرن عشان يغطي كل السيناريوهات)
    target: {
      // لو الـ HOD بيدي تاسك لدكاترة القسم كله
      department_id: { type: Schema.Types.ObjectId, ref: "Department" },
      // لو الانستراكتور بيدي تاسك لطلبة كورس معين (لو عندكم كوليكشن للكورسات)
      course_id: { type: Schema.Types.ObjectId, ref: "Course" },
      // لو التاسك رايح لأشخاص بعينهم (سواء دكاترة أو طلاب)
      specific_users: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },

    // الملفات المرفقة مع التاسك (زي ملف PDF فيه شرح المشروع)
    // نفس الهيكل اللي بيرجع من الـ /upload endpoint بتاعك
    attachments: [
      {
        url: { type: String, required: true },
        fileName: { type: String },
        size: { type: Number },
      },
    ],

    // ده الحقل السحري للـ AI (الـ Rubric) اللي الذكاء الاصطناعي هيقيم بناءً عليه
    ai_grading_rubric: { type: String },

    deadline: { type: Date, required: true },
    status: { type: String, enum: ["ACTIVE", "CLOSED"], default: "ACTIVE" },
  },
  { timestamps: true },
);

export default mongoose.model<ITask>("Task", taskSchema);
