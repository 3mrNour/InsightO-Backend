// modules/task/taskAnalytics.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure aggregation service — no schema changes, no business-logic side-effects.
// Reuses existing Task and TaskSubmission models.
// ─────────────────────────────────────────────────────────────────────────────

import Task from './task.model.js';
import TaskSubmission from '../taskSubmittion/taskSubmittion.model.js';
import Course from '../course/course.model.js';
import StudentProfile from '../profile/model/StudentProfile.js';
import mongoose from 'mongoose';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TaskAnalyticsSummary {
  totalTasks: number;
  submittedCount: number;
  notSubmittedCount: number;
  submissionRate: number; // 0-100 percentage
}

export interface StudentSubmissionStat {
  studentId: string;
  studentName: string;
  studentEmail: string;
  submittedCount: number;
}

export interface DailySubmissionStat {
  date: string; // "YYYY-MM-DD"
  count: number;
}

export interface SubmissionTableRow {
  studentName: string;
  taskTitle: string;
  status: string;
  submissionDate: string | null;
  finalGrade: number | null;
}

export interface TaskAnalyticsResult {
  summary: TaskAnalyticsSummary;
  charts: {
    submittedVsNotSubmitted: { name: string; value: number }[];
    submissionsPerStudent: StudentSubmissionStat[];
    submissionsOverTime: DailySubmissionStat[];
  };
  table: SubmissionTableRow[];
}

// ── Service ───────────────────────────────────────────────────────────────────

export const TaskAnalyticsService = {

  /**
   * Returns the full analytics payload with hierarchical filtering.
   * All queries use MongoDB aggregation — no schema changes required.
   */
  async getAnalytics(options: { departmentId?: string; courseId?: string; taskId?: string } = {}): Promise<TaskAnalyticsResult> {
    let targetTaskIds: mongoose.Types.ObjectId[] | undefined;
    let expectedSubmissions = 0;

    if (options.taskId) {
      const task = await Task.findById(options.taskId).select('_id target');
      if (task) {
        targetTaskIds = [task._id as mongoose.Types.ObjectId];
        if (task.target?.course_id) {
          expectedSubmissions = await StudentProfile.countDocuments({ enrolledCourses: task.target.course_id });
        }
      }
    } else if (options.courseId) {
      const tasks = await Task.find({ "target.course_id": options.courseId }).select('_id');
      targetTaskIds = tasks.map(t => t._id as mongoose.Types.ObjectId);
      const enrolled = await StudentProfile.countDocuments({ enrolledCourses: options.courseId });
      expectedSubmissions = enrolled * targetTaskIds.length;
    } else if (options.departmentId) {
      const courses = await Course.find({ departmentId: options.departmentId }).select('_id');
      const courseIds = courses.map(c => c._id);
      const tasks = await Task.find({ "target.course_id": { $in: courseIds } }).select('_id target.course_id');
      targetTaskIds = tasks.map(t => t._id as mongoose.Types.ObjectId);
      
      let totalExpected = 0;
      for (const courseId of courseIds) {
        const enrolled = await StudentProfile.countDocuments({ enrolledCourses: courseId });
        const tasksInCourse = tasks.filter(t => t.target?.course_id?.toString() === courseId.toString()).length;
        totalExpected += (enrolled * tasksInCourse);
      }
      expectedSubmissions = totalExpected;
    } else {
      const allTasks = await Task.find().select('_id target.course_id');
      const courses = await Course.find().select('_id');
      let totalExpected = 0;
      for (const course of courses) {
        const enrolled = await StudentProfile.countDocuments({ enrolledCourses: course._id });
        const tasksInCourse = allTasks.filter(t => t.target?.course_id?.toString() === course._id.toString()).length;
        totalExpected += (enrolled * tasksInCourse);
      }
      expectedSubmissions = totalExpected;
    }

    const [
      totalTasks,
      summary,
      submissionsPerStudent,
      submissionsOverTime,
      tableRows,
    ] = await Promise.all([
      TaskAnalyticsService._countTotalTasks(targetTaskIds),
      TaskAnalyticsService._getSubmissionSummary(targetTaskIds),
      TaskAnalyticsService._getSubmissionsPerStudent(targetTaskIds),
      TaskAnalyticsService._getSubmissionsOverTime(targetTaskIds),
      TaskAnalyticsService._getTableRows(targetTaskIds),
    ]);

    const submitted = summary.submittedCount;
    const notSubmitted = Math.max(0, expectedSubmissions - submitted);
    const submissionRate =
      expectedSubmissions > 0 ? Math.round((submitted / expectedSubmissions) * 100) : 0;

    return {
      summary: {
        totalTasks,
        submittedCount: submitted,
        notSubmittedCount: notSubmitted,
        submissionRate,
      },
      charts: {
        submittedVsNotSubmitted: [
          { name: 'Submitted', value: submitted },
          { name: 'Not Submitted', value: notSubmitted },
        ],
        submissionsPerStudent,
        submissionsOverTime,
      },
      table: tableRows,
    };
  },

  // ── Private helpers ────────────────────────────────────────────────────────

  async _countTotalTasks(targetTaskIds?: mongoose.Types.ObjectId[]): Promise<number> {
    if (targetTaskIds) {
      return targetTaskIds.length;
    }
    return Task.countDocuments();
  },

  async _getSubmissionSummary(targetTaskIds?: mongoose.Types.ObjectId[]): Promise<{ submittedCount: number }> {
    const pipeline: any[] = [];
    if (targetTaskIds) {
      pipeline.push({ $match: { task_id: { $in: targetTaskIds } } });
    }
    pipeline.push({
      $group: {
        _id: null,
        submittedCount: { $sum: 1 },
      },
    });
    
    const result = await TaskSubmission.aggregate(pipeline);
    return result[0] ?? { submittedCount: 0 };
  },

  async _getSubmissionsPerStudent(targetTaskIds?: mongoose.Types.ObjectId[]): Promise<StudentSubmissionStat[]> {
    const pipeline: any[] = [];
    if (targetTaskIds) {
      pipeline.push({ $match: { task_id: { $in: targetTaskIds } } });
    }
    
    pipeline.push(...[
      // Group by submitter
      {
        $group: {
          _id: '$submitter_id',
          submittedCount: { $sum: 1 },
        },
      },
      // Join with User collection to get name/email
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
      // Shape the output
      {
        $project: {
          _id: 0,
          studentId: { $toString: '$_id' },
          studentName: {
            $concat: [
              { $ifNull: ['$user.firstName', ''] },
              ' ',
              { $ifNull: ['$user.lastName', ''] },
            ],
          },
          studentEmail: { $ifNull: ['$user.email', ''] },
          submittedCount: 1,
        },
      },
      { $sort: { submittedCount: -1 } },
      { $limit: 20 }, // top-20 for the bar chart
    ]);
    const result = await TaskSubmission.aggregate(pipeline);
    return result as StudentSubmissionStat[];
  },

  async _getSubmissionsOverTime(targetTaskIds?: mongoose.Types.ObjectId[]): Promise<DailySubmissionStat[]> {
    // Last 30 days only — keeps the line chart readable
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const matchStage: any = { createdAt: { $gte: thirtyDaysAgo } };
    if (targetTaskIds) {
      matchStage.task_id = { $in: targetTaskIds };
    }

    const result = await TaskSubmission.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1,
        },
      },
    ]);
    return result as DailySubmissionStat[];
  },

  async _getTableRows(targetTaskIds?: mongoose.Types.ObjectId[]): Promise<SubmissionTableRow[]> {
    const pipeline: any[] = [];
    if (targetTaskIds) {
      pipeline.push({ $match: { task_id: { $in: targetTaskIds } } });
    }

    pipeline.push(...[
      // Bring in Task data
      {
        $lookup: {
          from: 'tasks',
          localField: 'task_id',
          foreignField: '_id',
          as: 'task',
        },
      },
      { $unwind: { path: '$task', preserveNullAndEmptyArrays: false } },
      // Bring in User data
      {
        $lookup: {
          from: 'users',
          localField: 'submitter_id',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: 0,
          studentName: {
            $concat: [
              { $ifNull: ['$student.firstName', ''] },
              ' ',
              { $ifNull: ['$student.lastName', ''] },
            ],
          },
          taskTitle: '$task.title',
          status: '$status',
          submissionDate: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          finalGrade: { $ifNull: ['$final_grade', null] },
        },
      },
      { $sort: { submissionDate: -1 } },
      { $limit: 200 }, // practical cap for the table
    ]);
    const result = await TaskSubmission.aggregate(pipeline);
    return result as SubmissionTableRow[];
  },
};
