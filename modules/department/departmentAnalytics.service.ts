import mongoose from 'mongoose';
import Department from './model/Department.js';
import Course from '../course/course.model.js';
import StudentProfile from '../profile/model/StudentProfile.js';
import User from '../auth/model/User_Schema.js';
import Task from '../task/task.model.js';
import TaskSubmission from '../taskSubmittion/taskSubmittion.model.js';

export interface GlobalDepartmentAnalytics {
  kpis: {
    totalDepartments: number;
    totalCourses: number;
    totalStudents: number;
    totalInstructors: number;
  };
  comparisons: {
    departmentId: string;
    departmentName: string;
    enrollmentCount: number;
    courseCount: number;
    completionRate: number; // Replacer for averageGrade
    submissionCount: number;
  }[];
}

export interface DepartmentSpecificAnalyticsResult {
  kpis: {
    totalEnrolled: number;
    totalCourses: number;
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

let cachedGlobalAnalytics: { data: GlobalDepartmentAnalytics; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export const DepartmentAnalyticsService = {
  async getGlobalAnalytics(): Promise<GlobalDepartmentAnalytics> {
    const now = Date.now();
    if (cachedGlobalAnalytics && (now - cachedGlobalAnalytics.timestamp < CACHE_TTL_MS)) {
      return cachedGlobalAnalytics.data;
    }

    const [
      totalDepartments,
      totalCourses,
      totalStudents,
      totalInstructors,
      departments,
      allActiveCourses
    ] = await Promise.all([
      Department.countDocuments(),
      Course.countDocuments({ isActive: true }),
      StudentProfile.countDocuments(),
      User.countDocuments({ role: 'INSTRUCTOR', isActive: true }),
      Department.find().select('_id name'),
      Course.find({ isActive: true }).select('_id departmentId')
    ]);

    // 1. Unique Enrollment per Department
    const enrollmentAggr = await StudentProfile.aggregate([
      { $unwind: "$enrolledCourses" },
      { $lookup: { from: "courses", localField: "enrolledCourses", foreignField: "_id", as: "course" } },
      { $unwind: { path: "$course", preserveNullAndEmptyArrays: false } },
      { $group: { _id: "$course.departmentId", uniqueStudents: { $addToSet: "$userId" } } },
      { $project: { departmentId: "$_id", count: { $size: "$uniqueStudents" } } }
    ]);
    const enrollmentMap = new Map();
    enrollmentAggr.forEach(item => enrollmentMap.set(item.departmentId?.toString(), item.count));

    // 2. Courses per Department
    const courseMap = new Map();
    allActiveCourses.forEach(c => {
      const dId = c.departmentId?.toString();
      if (dId) courseMap.set(dId, (courseMap.get(dId) || 0) + 1);
    });

    // 3. Submissions per Department
    const performanceAggr = await TaskSubmission.aggregate([
      { $lookup: { from: "tasks", localField: "task_id", foreignField: "_id", as: "task" } },
      { $unwind: { path: "$task", preserveNullAndEmptyArrays: false } },
      { $lookup: { from: "courses", localField: "task.target.course_id", foreignField: "_id", as: "course" } },
      { $unwind: { path: "$course", preserveNullAndEmptyArrays: false } },
      { 
        $group: { 
          _id: "$course.departmentId", 
          submissionCount: { $sum: 1 } 
        } 
      }
    ]);
    const submissionMap = new Map();
    performanceAggr.forEach(item => {
      if (item._id) submissionMap.set(item._id.toString(), item.submissionCount);
    });

    // 4. Expected Submissions calculation (Tasks * Enrolled per course)
    const courseTasksAggr = await Task.aggregate([
      { $group: { _id: "$target.course_id", taskCount: { $sum: 1 } } }
    ]);
    const courseTaskMap = new Map();
    courseTasksAggr.forEach(t => courseTaskMap.set(t._id?.toString(), t.taskCount));

    const courseEnrollmentAggr = await StudentProfile.aggregate([
      { $unwind: "$enrolledCourses" },
      { $group: { _id: "$enrolledCourses", studentCount: { $sum: 1 } } }
    ]);
    const courseEnrollmentMap = new Map();
    courseEnrollmentAggr.forEach(e => courseEnrollmentMap.set(e._id?.toString(), e.studentCount));

    const deptExpectedSubmissions = new Map<string, number>();
    allActiveCourses.forEach(c => {
      const dId = c.departmentId?.toString();
      if (!dId) return;
      const cId = c._id.toString();
      const tCount = courseTaskMap.get(cId) || 0;
      const eCount = courseEnrollmentMap.get(cId) || 0;
      deptExpectedSubmissions.set(dId, (deptExpectedSubmissions.get(dId) || 0) + (tCount * eCount));
    });

    // 5. Build Comparison Array
    const comparisons = departments.map(dept => {
      const dId = dept._id.toString();
      const actualSubmissions = submissionMap.get(dId) || 0;
      const expectedSubmissions = deptExpectedSubmissions.get(dId) || 0;
      
      let completionRate = 0;
      if (expectedSubmissions > 0) {
        completionRate = Math.min(100, Math.round((actualSubmissions / expectedSubmissions) * 100));
      } else if (actualSubmissions > 0) {
        completionRate = 100;
      }

      return {
        departmentId: dId,
        departmentName: dept.name,
        enrollmentCount: enrollmentMap.get(dId) || 0,
        courseCount: courseMap.get(dId) || 0,
        completionRate,
        submissionCount: actualSubmissions
      };
    });

    const result: GlobalDepartmentAnalytics = {
      kpis: {
        totalDepartments,
        totalCourses,
        totalStudents,
        totalInstructors
      },
      comparisons
    };

    cachedGlobalAnalytics = {
      data: result,
      timestamp: now
    };

    return result;
  },

  async getDepartmentSpecificAnalytics(departmentId: string): Promise<DepartmentSpecificAnalyticsResult> {
    const deptObjId = new mongoose.Types.ObjectId(departmentId);

    // 1. Get all courses in this department
    const courses = await Course.find({ departmentId: deptObjId, isActive: true }).select('_id');
    const courseIds = courses.map(c => c._id);
    const totalCourses = courseIds.length;

    // 2. Get total enrolled unique students
    const enrolledProfiles = await StudentProfile.find({ enrolledCourses: { $in: courseIds } })
      .populate('userId', 'firstName lastName email')
      .lean();
    
    // De-duplicate enrolled students
    const uniqueStudentsMap = new Map();
    enrolledProfiles.forEach(p => {
      const u = p.userId as any;
      if (u && u._id) {
        uniqueStudentsMap.set(u._id.toString(), p);
      }
    });
    
    const uniqueStudentProfiles = Array.from(uniqueStudentsMap.values());
    const totalEnrolled = uniqueStudentProfiles.length;

    // 3. Get total tasks across all these courses
    const tasks = await Task.find({ "target.course_id": { $in: courseIds } }).select('_id target.course_id');
    const totalTasks = tasks.length;
    const taskIds = tasks.map(t => t._id);

    // 4. Calculate Expected Submissions accurately
    // We can't just multiply totalTasks * totalEnrolled. 
    // We must count expected submissions per course: courseTaskCount * courseEnrolledCount
    let expectedSubmissions = 0;
    for (const courseId of courseIds) {
      const cTasksCount = tasks.filter(t => t.target.course_id.toString() === courseId.toString()).length;
      const cEnrolledCount = enrolledProfiles.filter(p => p.enrolledCourses.some((id: any) => id.toString() === courseId.toString())).length;
      expectedSubmissions += cTasksCount * cEnrolledCount;
    }

    // 5. Get all submissions
    const submissions = await TaskSubmission.find({ task_id: { $in: taskIds } }).lean();
    const totalSubmissions = submissions.length;

    // 6. Map student stats
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

    // 7. Build student roster
    const studentRoster = uniqueStudentProfiles.map(profile => {
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
    }).filter(Boolean) as DepartmentSpecificAnalyticsResult['students'];

    // 8. Calculate KPIs
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
        totalCourses,
        totalTasks,
        completionRate,
        averageGrade
      },
      students: studentRoster.sort((a, b) => b.averageGrade - a.averageGrade)
    };
  }
};
