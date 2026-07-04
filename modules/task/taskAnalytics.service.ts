// modules/task/taskAnalytics.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure aggregation service — no schema changes, no business-logic side-effects.
// Reuses existing Task and TaskSubmission models.
// ─────────────────────────────────────────────────────────────────────────────

import Task from './task.model.js';
import TaskSubmission from '../taskSubmittion/taskSubmittion.model.js';
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
   * Returns the full analytics payload in a single call.
   * All queries use MongoDB aggregation — no schema changes required.
   */
  async getAnalytics(): Promise<TaskAnalyticsResult> {
    const [
      totalTasks,
      summary,
      submissionsPerStudent,
      submissionsOverTime,
      tableRows,
    ] = await Promise.all([
      TaskAnalyticsService._countTotalTasks(),
      TaskAnalyticsService._getSubmissionSummary(),
      TaskAnalyticsService._getSubmissionsPerStudent(),
      TaskAnalyticsService._getSubmissionsOverTime(),
      TaskAnalyticsService._getTableRows(),
    ]);

    const submitted = summary.submittedCount;
    const notSubmitted = Math.max(0, totalTasks - submitted);
    const submissionRate =
      totalTasks > 0 ? Math.round((submitted / totalTasks) * 100) : 0;

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

  async _countTotalTasks(): Promise<number> {
    return Task.countDocuments();
  },

  async _getSubmissionSummary(): Promise<{ submittedCount: number }> {
    // Count unique (task_id, submitter_id) pairs — each pair = one submission event
    const result = await TaskSubmission.aggregate([
      {
        $group: {
          _id: null,
          submittedCount: { $sum: 1 },
        },
      },
    ]);
    return result[0] ?? { submittedCount: 0 };
  },

  async _getSubmissionsPerStudent(): Promise<StudentSubmissionStat[]> {
    const result = await TaskSubmission.aggregate([
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
    return result as StudentSubmissionStat[];
  },

  async _getSubmissionsOverTime(): Promise<DailySubmissionStat[]> {
    // Last 30 days only — keeps the line chart readable
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await TaskSubmission.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
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

  async _getTableRows(): Promise<SubmissionTableRow[]> {
    // Join TaskSubmission ↔ Task ↔ User
    const result = await TaskSubmission.aggregate([
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
    return result as SubmissionTableRow[];
  },
};
