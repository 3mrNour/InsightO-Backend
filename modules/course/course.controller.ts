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

  // ✅ Auto-sync: Add course to instructor's teachingCourses
  if (instructorId) {
    await InstructorProfile.findOneAndUpdate(
      { userId: instructorId },
      { $addToSet: { teachingCourses: newCourse._id } }
    );
  }

  // ✅ Auto-sync: Enroll students
  if (Array.isArray(req.body.studentIds)) {
    const validStudents = await User.find({
      _id: { $in: req.body.studentIds },
      role: UserSchema ? UserSchema.STUDENT : 'STUDENT',
    });
    const validStudentObjectIds = validStudents.map(s => s._id);

    if (validStudentObjectIds.length > 0) {
      await StudentProfile.updateMany(
        { userId: { $in: validStudentObjectIds } },
        { $addToSet: { enrolledCourses: newCourse._id } }
      );
    }
  }

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
    
    query = { _id: { $in: studentProfile.enrolledCourses } };
    
  } else if (userRole === "INSTRUCTOR") {
    query = { instructorId: userId };
    
  } else if (userRole === "HOD") {
    const hodProfile = await HODProfile.findOne({ userId });
    if (!hodProfile) return next(new AppError("HOD profile not found", 404));
    
    query = { departmentId: hodProfile.departmentId };
    
  } else if (userRole === "ADMIN") {
    query = {};
  }

  // نستخدم lean() عشان نقدر نعدل على الأوبجكت اللي راجع
  const courses = await Course.find(query)
    .populate("instructorId", "firstName lastName email")
    .populate("departmentId", "name code")
    .sort({ createdAt: -1 })
    .lean();

  // 🚀 جلب الطلبة المسجلين لكل كورس وإضافتهم ديناميكياً
  const coursesWithStudents = await Promise.all(
    courses.map(async (course) => {
      // نبحث في بروفايلات الطلبة عن أي طالب مسجل في الكورس ده
      const enrolledProfiles = await StudentProfile.find({ enrolledCourses: course._id })
        .populate("userId", "firstName lastName email"); // بنجيب بيانات الطالب الأساسية
      
      // نستخرج بيانات اليوزر من البروفايل
      const enrolledStudents = enrolledProfiles.map(profile => profile.userId).filter(Boolean);
      
      return {
        ...course,
        enrolledStudents // دلوقتي الفرونت إند هيلاقي المصفوفة دي مليانة!
      };
    })
  );

  res.status(200).json({
    status: "success",
    count: coursesWithStudents.length,
    data: { courses: coursesWithStudents },
  });
});

export const getCourseById = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const courseDoc = await Course.findById(req.params.id)
    .populate("instructorId", "firstName lastName email")
    .populate("departmentId", "name code")
    .lean();

  if (!courseDoc) {
    return next(new AppError("Course not found", 404));
  }

  // 🚀 جلب الطلبة المسجلين في هذا الكورس تحديداً
  const enrolledProfiles = await StudentProfile.find({ enrolledCourses: courseDoc._id })
    .populate("userId", "firstName lastName email");
    
  const enrolledStudents = enrolledProfiles.map(profile => profile.userId).filter(Boolean);

  const course = {
    ...courseDoc,
    enrolledStudents
  };

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

  const oldInstructorId = course.instructorId?.toString();
  const newInstructorId = req.body.instructorId;

  const updatedCourse = await Course.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  // ✅ Auto-sync: Handle instructor change
  if (req.body.instructorId !== undefined) {
    const newInstructorIdStr = newInstructorId ? newInstructorId.toString() : null;
    if (newInstructorIdStr !== oldInstructorId) {
      if (oldInstructorId) {
        await InstructorProfile.findOneAndUpdate(
          { userId: oldInstructorId },
          { $pull: { teachingCourses: course._id } }
        );
      }
      if (newInstructorIdStr) {
        await InstructorProfile.findOneAndUpdate(
          { userId: newInstructorIdStr },
          { $addToSet: { teachingCourses: course._id } }
        );
      }
    }
  }

  // ✅ Auto-sync: Enroll students
  if (Array.isArray(req.body.studentIds)) {
    const validStudents = await User.find({
      _id: { $in: req.body.studentIds },
      role: UserSchema ? UserSchema.STUDENT : 'STUDENT',
    });
    const validStudentObjectIds = validStudents.map(s => s._id);

    // Remove course from students not in the list
    await StudentProfile.updateMany(
      { 
        enrolledCourses: course._id, 
        userId: { $nin: validStudentObjectIds } 
      },
      { $pull: { enrolledCourses: course._id } }
    );

    // Add course to students in the list
    if (validStudentObjectIds.length > 0) {
      await StudentProfile.updateMany(
        { userId: { $in: validStudentObjectIds } },
        { $addToSet: { enrolledCourses: course._id } }
      );
    }
  }

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

  // ✅ Auto-sync: Remove course from instructor's teachingCourses before deletion
  if (course.instructorId) {
    await InstructorProfile.findOneAndUpdate(
      { userId: course.instructorId },
      { $pull: { teachingCourses: course._id } }
    );
  }

  await course.deleteOne();

  res.status(200).json({ status: "success", message: "Course deleted successfully" });
});