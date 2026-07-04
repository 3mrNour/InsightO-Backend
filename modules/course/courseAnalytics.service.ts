import mongoose from 'mongoose';
import Course from './course.model.js';
import StudentProfile from '../profile/model/StudentProfile.js';
import Task from '../task/task.model.js';
import TaskSubmission from '../taskSubmittion/taskSubmittion.model.js';

export interface CourseAnalyticsResult {
  kpis: {
    totalEnrolled: number;
    totalTasks: number;
    completionRate: number;
    averageGrade: number;
  };
  students: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    tasksCompleted: number;
    averageGrade: number;
  }[];
}

export const CourseAnalyticsService = {
  async getCourseAnalytics(courseId: string): Promise<CourseAnalyticsResult> {
    const courseObjId = new mongoose.Types.ObjectId(courseId);

    // 1. Get total enrolled students
    const enrolledProfiles = await StudentProfile.find({ enrolledCourses: courseObjId })
      .populate('userId', 'firstName lastName email')
      .lean();
    
    const totalEnrolled = enrolledProfiles.length;

    // 2. Get total tasks for this course
    const tasks = await Task.find({ "target.course_id": courseObjId }).select('_id');
    const totalTasks = tasks.length;
    const taskIds = tasks.map(t => t._id);

    // 3. Get all submissions for these tasks
    const submissions = await TaskSubmission.find({ task_id: { $in: taskIds } }).lean();

    // Map student submissions
    const studentStatsMap = new Map<string, { count: number; totalGrade: number; gradedCount: number }>();
    let overallGradeSum = 0;
    let gradedSubmissionsCount = 0;

    submissions.forEach(sub => {
      const studentIdStr = sub.submitter_id.toString();
      const stats = studentStatsMap.get(studentIdStr) || { count: 0, totalGrade: 0, gradedCount: 0 };
      
      stats.count += 1;
      if (typeof sub.final_grade === 'number') {
        stats.totalGrade += sub.final_grade;
        stats.gradedCount += 1;
        overallGradeSum += sub.final_grade;
        gradedSubmissionsCount += 1;
      }
      
      studentStatsMap.set(studentIdStr, stats);
    });

    // 4. Build student roster
    const studentRoster = enrolledProfiles.map(profile => {
      const user = profile.userId as any;
      if (!user) return null;
      
      const stats = studentStatsMap.get(user._id.toString()) || { count: 0, totalGrade: 0, gradedCount: 0 };
      const averageGrade = stats.gradedCount > 0 ? Math.round(stats.totalGrade / stats.gradedCount) : 0;

      return {
        userId: user._id.toString(),
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        tasksCompleted: stats.count,
        averageGrade
      };
    }).filter(Boolean) as CourseAnalyticsResult['students'];

    // 5. Calculate KPIs
    const expectedSubmissions = totalEnrolled * totalTasks;
    const totalSubmissions = submissions.length;
    
    let completionRate = 0;
    if (expectedSubmissions > 0) {
      completionRate = Math.min(100, Math.round((totalSubmissions / expectedSubmissions) * 100));
    } else if (totalSubmissions > 0) {
      completionRate = 100;
    }

    const averageGrade = gradedSubmissionsCount > 0 
      ? Math.round(overallGradeSum / gradedSubmissionsCount) 
      : 0;

    return {
      kpis: {
        totalEnrolled,
        totalTasks,
        completionRate,
        averageGrade
      },
      students: studentRoster.sort((a, b) => b.averageGrade - a.averageGrade) // Sort by performance descending
    };
  }
};
