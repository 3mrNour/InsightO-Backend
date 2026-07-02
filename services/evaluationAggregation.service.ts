import { Types } from "mongoose";
import Submission from "../modules/submission/submission.model.js";

export class EvaluationAggregationService {
  /**
   * Aggregates evaluation history for a given subject based on separate survey forms.
   */
  public static async aggregateSubjectHistory(subjectId: string | Types.ObjectId) {
    // التأكد من عمل التجميع والـ populate بشكل سليم
    const submissions = await Submission.find({ subject_id: subjectId })
      .populate("form_id") // هنعمل populate لكل الفيلد عشان نضمن الـ title
      .populate("answers.question_id")
      .lean();

    const formDataMap: Record<string, {
      formTitle: string;
      createdAt: Date;
      totalScore: number;
      count: number;
      submissionCount: number
    }> = {};

    const groupedData: Record<string, string[]> = {};
    let totalSubmissions = 0;

    for (const sub of submissions) {
      // حماية: لو الـ form_id مش موجود أو مصلحلوش populate كـ object، تخطى الريكورد
      if (!sub.createdAt || !sub.form_id || typeof sub.form_id !== 'object') continue;

      totalSubmissions++;

      const formDoc = sub.form_id as any;
      const formId = formDoc._id ? formDoc._id.toString() : Math.random().toString();
      const formTitle = formDoc.title || "Untitled Survey";

      if (!formDataMap[formId]) {
        formDataMap[formId] = {
          formTitle,
          createdAt: new Date(sub.createdAt), // نضمن إنه Date Object
          totalScore: 0,
          count: 0,
          submissionCount: 0
        };
      }

      if (!groupedData[formTitle]) {
        groupedData[formTitle] = [];
      }

      formDataMap[formId].submissionCount += 1;

      if (Array.isArray(sub.answers)) {
        for (const answer of sub.answers) {
          const question = answer.question_id as any;
          if (!question) continue;

          const val = answer.value;
          if (val === undefined || val === null || val === "") continue;

          // Quantitative (الكيرف)
          if (question.type === "linear_scale" && (typeof val === "number" || !isNaN(Number(val)))) {
            formDataMap[formId].totalScore += Number(val);
            formDataMap[formId].count += 1;
          }
          // Qualitative (الـ AI)
          else if ((question.type === "short_text" || question.type === "long_text") && typeof val === "string") {
            const text = val.trim();
            if (text) {
              groupedData[formTitle].push(text);
            }
          }
        }
      }
    }

    if (totalSubmissions === 0) {
      throw new Error("EMPTY_DATASET");
    }

    // تنسيق الداتا وترتيبها زمنياً
    const chartData = Object.entries(formDataMap)
      .map(([formId, data]) => {
        const formattedDate = data.createdAt.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        return {
          formId,
          formTitle: data.formTitle,
          date: formattedDate,
          averageScore: data.count > 0 ? Number((data.totalScore / data.count).toFixed(2)) : 0,
          submissionCount: data.submissionCount,
          // الـ Recharts محتاج حقل "year" لأنه متثبت في الـ XAxis بتاع الكومبوننت القديم
          year: formattedDate
        };
      })
      // الترتيب من الأقدم للأحدث بناءً على الطابع الزمني الحقيقي
      .sort((a, b) => formDataMap[a.formId].createdAt.getTime() - formDataMap[b.formId].createdAt.getTime());

    return { chartData, groupedData, totalSubmissions };
  }
}
