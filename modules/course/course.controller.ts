// src/modules/course/course.controller.ts

import type { Request, Response, NextFunction } from "express";
import Course from "./course.model.js";
import StudentProfile from "../profile/model/StudentProfile.js";
import InstructorProfile from "../profile/model/InstructorProfile.js";
import HODProfile from "../profile/model/HODProfile.js";
import { AppError } from "../../utils/AppError.js";
import { asyncWrap } from "../../middlewares/asyncWrap.js";
import User from "../auth/model/User_Schema.js";
import { UserSchema } from "../../utils/User.js";
export const createCourse = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { name, courseCode, description, departmentId, instructorId, credits, isActive } = req.body;
  const user = (req as any).user;
  const userId = user?.id || user?._id;

  // 🚨 فحص صلاحيات رئيس القسم: لا يمكنه إنشاء كورس خارج قسمه
  if (user.role === "HOD") {
    const hodProfile = await HODProfile.findOne({ userId });
    if (hodProfile?.departmentId.toString() !== departmentId) {
      return next(new AppError("You can only create courses for your own department", 403));
    }
  }

  const newCourse = await Course.create({
    name,
    courseCode,
    description,
    departmentId,
    instructorId,
    credits,
    isActive,
  });

  res.status(201).json({
    status: "success",
    data: { course: newCourse },
  });
});

export const getCourses = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;
  const userRole = user?.role;
  const userId = user?.id || user?._id;
  let query: any = {};

  // 🧠 Context-Aware Query: جلب الكورسات حسب الدور
  if (userRole === "STUDENT") {
    const studentProfile = await StudentProfile.findOne({ userId });
    if (!studentProfile) return next(new AppError("Student profile not found", 404));
    
    // الطالب يرى فقط الكورسات المسجل بها
    query = { _id: { $in: studentProfile.enrolledCourses } };
    
  } else if (userRole === "INSTRUCTOR") {
    // المحاضر يرى الكورسات التي يقوم بتدريسها
    query = { instructorId: userId };
    
  } else if (userRole === "HOD") {
    const hodProfile = await HODProfile.findOne({ userId });
    if (!hodProfile) return next(new AppError("HOD profile not found", 404));
    
    // رئيس القسم يرى جميع كورسات قسمه
    query = { departmentId: hodProfile.departmentId };
    
  } else if (userRole === "ADMIN") {
    // الأدمن يرى كل الكورسات
    query = {};
  }

  const courses = await Course.find(query)
    .populate("instructorId", "firstName lastName email")
    .populate("departmentId", "name code")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    count: courses.length,
    data: { courses },
  });
});

export const getCourseById = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const course = await Course.findById(req.params.id)
    .populate("instructorId", "firstName lastName email")
    .populate("departmentId", "name code");

  if (!course) {
    return next(new AppError("Course not found", 404));
  }

  res.status(200).json({ status: "success", data: { course } });
});

export const updateCourse = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;
  const userId = user?.id || user?._id;

  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(new AppError("Course not found", 404));
  }

  // 🚨 فحص الصلاحيات للتعديل: HOD يعدل كورسات قسمه فقط
  if (user.role === "HOD") {
    const hodProfile = await HODProfile.findOne({ userId });
    if (hodProfile?.departmentId.toString() !== course.departmentId.toString()) {
      return next(new AppError("Not authorized to update courses outside your department", 403));
    }
  }

  const updatedCourse = await Course.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ status: "success", data: { course: updatedCourse } });
});

export const deleteCourse = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;
  const userId = user?.id || user?._id;

  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(new AppError("Course not found", 404));
  }

  // 🚨 فحص الصلاحيات للحذف: HOD يحذف كورسات قسمه فقط
  if (user.role === "HOD") {
    const hodProfile = await HODProfile.findOne({ userId });
    if (hodProfile?.departmentId.toString() !== course.departmentId.toString()) {
      return next(new AppError("Not authorized to delete courses outside your department", 403));
    }
  }

  await course.deleteOne();

  res.status(200).json({ status: "success", message: "Course deleted successfully" });
});

export const enrollStudents = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { studentIds } = req.body;
  const courseId = req.params.id;
  const user = (req as any).user;
  const userId = user?.id || user?._id;

  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError("Course not found", 404));
  }

  // HOD must only enroll students in courses within their department
  if (user.role === "HOD") {
    const hodProfile = await HODProfile.findOne({ userId });
    if (hodProfile?.departmentId.toString() !== course.departmentId.toString()) {
      return next(new AppError("Not authorized to enroll students in courses outside your department", 403));
    }
  }

  // Find all provided user IDs that are actually STUDENTS
  const validStudents = await User.find({
    _id: { $in: studentIds },
    role: UserSchema ? UserSchema.STUDENT : 'STUDENT',
  });

  if (validStudents.length === 0) {
    return next(new AppError("No valid students found with the provided IDs", 400));
  }

  const validStudentIds = validStudents.map(student => student._id);

  // Update their StudentProfile to include this courseId (no duplicates)
  await StudentProfile.updateMany(
    { userId: { $in: validStudentIds } },
    { $addToSet: { enrolledCourses: courseId } }
  );

  res.status(200).json({
    status: "success",
    message: `Successfully enrolled ${validStudentIds.length} students in the course.`,
    data: {
      enrolledCount: validStudentIds.length,
      validStudentIds,
    }
  });
});