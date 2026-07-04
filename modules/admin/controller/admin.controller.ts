import type { Request, Response, NextFunction } from "express";
import { asyncWrap } from "../../../middlewares/asyncWrap.js";
import { AppError } from "../../../utils/AppError.js";
import mongoose from "mongoose";

// Models
import User from "../../auth/model/User_Schema.js";
import Form from "../../form/model/formSchema.js";
import Submission from "../../submission/submission.model.js";
import Task from "../../task/task.model.js";
import TokenUsage from "../../AI/tokenUsage.model.js";
import Department from "../../department/model/Department.js";
import Course from "../../course/course.model.js";
import StudentProfile from "../../profile/model/StudentProfile.js";
import TaskSubmission from "../../taskSubmittion/taskSubmittion.model.js";

export const getDashboardMetrics = asyncWrap(
  async (req: Request, res: Response, next: NextFunction) => {
    
    // 1. KPIs
    const totalUsers = await User.countDocuments();
    const totalForms = await Form.countDocuments();
    const totalSubmissions = await Submission.countDocuments();
    const activeTasks = await Task.countDocuments({ status: "ACTIVE" });

    const tokenUsageAgg = await TokenUsage.aggregate([
      { $group: { _id: null, totalTokens: { $sum: "$totalTokens" } } }
    ]);
    const totalAITokens = tokenUsageAgg[0]?.totalTokens || 0;

    const totalDepartments = await Department.countDocuments();
    const totalCourses = await Course.countDocuments();
    const totalTasks = await Task.countDocuments();

    // 2. Charts Data
    
    // Form Distribution by Category
    const formCategories = await Form.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { name: "$_id", value: "$count", _id: 0 } }
    ]);

    // User Roles Breakdown
    const userRoles = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $project: { name: "$_id", value: "$count", _id: 0 } }
    ]);

    // Submissions over the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentSubmissionsChart = await Submission.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { 
        $group: { 
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, _id: 0 } }
    ]);

    // AI Usage by Feature
    const aiUsageByFeature = await TokenUsage.aggregate([
      { $group: { _id: "$feature", tokens: { $sum: "$totalTokens" } } },
      { $project: { name: "$_id", tokens: 1, _id: 0 } }
    ]);

    // 3. Recent Activity Lists
    
    // Recent Forms
    const recentFormsDocs = await Form.find()
      .select("title category is_active createdAt")
      .populate("creator_id", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(5);
      
    // Add submissions count to recent forms
    const recentForms = await Promise.all(recentFormsDocs.map(async (form) => {
      const responsesCount = await Submission.countDocuments({ form_id: form._id });
      return {
        ...form.toObject(),
        responsesCount
      };
    }));

    // Recent Submissions / Active Tasks
    const recentTasks = await Task.find({ status: "ACTIVE" })
      .select("title task_type deadline")
      .populate("creator_id", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(5);
      
    // Top AI Users
    const topAIUsers = await User.find({ ai_tokens_used: { $gt: 0 } })
      .select("firstName lastName email role ai_tokens_used ai_tokens_limit")
      .sort({ ai_tokens_used: -1 })
      .limit(5);

    // Courses Overview (Enrolled Students & Task Submissions)
    const courses = await Course.find()
      .select("name courseCode departmentId")
      .populate("departmentId", "name");
      
    const allTasks = await Task.find({ "target.course_id": { $exists: true } }).select("_id target");
    const allSubmissions = await TaskSubmission.find().select("task_id");
    const allStudentProfiles = await StudentProfile.find().select("enrolledCourses");

    const coursesOverview = courses.map(course => {
      const courseIdStr = course._id.toString();
      
      const enrolledStudents = allStudentProfiles.filter(s => 
        s.enrolledCourses?.some((cId: any) => cId.toString() === courseIdStr)
      ).length;

      const courseTasks = allTasks.filter(t => t.target?.course_id?.toString() === courseIdStr);
      const courseTaskIds = courseTasks.map(t => t._id.toString());
      
      const courseSubmissionsList = allSubmissions.filter(s => 
        courseTaskIds.includes(s.task_id.toString())
      );
      
      const courseSubmissions = courseSubmissionsList.length;

      const maxPossibleSubmissions = enrolledStudents * courseTasks.length;
      const engagementRate = maxPossibleSubmissions > 0 
        ? Math.round((courseSubmissions / maxPossibleSubmissions) * 100) 
        : 0;

      return {
        _id: course._id,
        name: course.name,
        courseCode: course.courseCode,
        departmentId: course.departmentId?._id,
        departmentName: (course.departmentId as any)?.name || "N/A",
        studentsCount: enrolledStudents,
        submissionsCount: courseSubmissions,
        engagementRate
      };
    }).sort((a, b) => b.studentsCount - a.studentsCount).slice(0, 10);

    const topPerformingCourses = [...coursesOverview]
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 5)
      .map(c => ({ name: c.courseCode, fullName: c.name, engagementRate: c.engagementRate }));

    res.status(200).json({
      status: "success",
      data: {
        kpis: {
          totalUsers,
          totalForms,
          totalSubmissions,
          activeTasks,
          totalTasks,
          totalAITokens,
          totalDepartments,
          totalCourses
        },
        charts: {
          formCategories,
          userRoles,
          recentSubmissionsChart,
          aiUsageByFeature,
          topPerformingCourses
        },
        recentActivity: {
          recentForms,
          recentTasks,
          topAIUsers,
          coursesOverview
        }
      }
    });
  }
);
