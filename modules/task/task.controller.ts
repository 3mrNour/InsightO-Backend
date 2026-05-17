import type { Request, Response, NextFunction } from "express";
import Task from "./task.model.js";
import StudentProfile from "../profile/model/StudentProfile.js";
import InstructorProfile from "../profile/model/InstructorProfile.js";
import HODProfile from "../profile/model/HODProfile.js";
import { AppError } from "../../utils/AppError.js";
import { asyncWrap } from "../../middlewares/asyncWrap.js";
import { broadcastTaskToStudents } from "../../utils/taskNotifier.js";
export const createTask = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const {
    title,
    description,
    target,
    attachments,
    ai_grading_rubric,
    deadline,
  } = req.body;
  const user = (req as any).user;
  const userRole = user?.role; // جاي من الـ protect middleware

  // 🚨 Gatekeeper Logic: فحص الصلاحيات بناءً على الـ Target
  if (userRole === "INSTRUCTOR" && target?.department_id) {
    return next(new AppError("Instructors cannot assign tasks to an entire department.", 403));
  }

  // إنشاء المهمة
  const newTask = await Task.create({
    title,
    description,
    creator_id: user.id || user._id,
    target,
    attachments,
    ai_grading_rubric,
    deadline,
  });
  const courseId = newTask.target?.course_id;
if (courseId) {
  broadcastTaskToStudents(courseId.toString(), title, description, deadline)
    .catch(err => console.error("Email Broadcast Error:", err));
}
  res.status(201).json({
    status: "success",
    data: { task: newTask },
  });
});

export const getTasks = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;
  const userRole = user?.role;
  const userId = user?.id || user?._id;
  let query: any = {};

  // 🧠 Context-Aware Query: كل يوزر بيشوف اللي يخصه بس
  if (userRole === "STUDENT") {
    const studentProfile = await StudentProfile.findOne({ userId });
    if (!studentProfile) return next(new AppError("Student profile not found", 404));

    // الطالب بيشوف التاسكات المبعوته ليه بالاسم، أو لكورساته، أو لقسمه
    query = { 
      $or: [
        { "target.specific_users": userId },
        { "target.course_id": { $in: studentProfile.enrolledCourses } },
        { "target.department_id": studentProfile.departmentId }
      ],
      status: "ACTIVE" 
    };

  } else if (userRole === "INSTRUCTOR") {
    const instructorProfile = await InstructorProfile.findOne({ userId });
    if (!instructorProfile) return next(new AppError("Instructor profile not found", 404));

    // المحاضر بيشوف التاسكات اللي هو عملها، وممكن يشوف التاسكات اللي جايه لقسمه أو كورساته أو مبعوته ليه بالاسم
    query = { 
      $or: [
        { creator_id: userId },
        { "target.specific_users": userId },
        { "target.department_id": instructorProfile.departmentId },
        { "target.course_id": { $in: instructorProfile.teachingCourses } }
      ]
    };
  } else if (userRole === "HOD") {
    const hodProfile = await HODProfile.findOne({ userId });
    if (!hodProfile) return next(new AppError("HOD profile not found", 404));

    // الـ HOD بيشوف التاسكات بتاعة قسمه، واللي هو عملها، واللي جياله بالاسم
    query = { 
      $or: [
        { creator_id: userId },
        { "target.department_id": hodProfile.departmentId },
        { "target.specific_users": userId }
      ]
    };
  } else if (userRole === "ADMIN") {
    query = {}; // الأدمن بيشوف كل حاجة
  }

  const tasks = await Task.find(query)
    .populate("creator_id", "firstName lastName email")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    count: tasks.length,
    data: { tasks },
  });
});

export const getTaskById = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const task = await Task.findById(req.params.id).populate(
    "creator_id",
    "firstName lastName email",
  );

  if (!task) {
    return next(new AppError("Task not found", 404));
  }

  res.status(200).json({ status: "success", data: { task } });
});

export const updateTask = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;
  const userId = user?.id || user?._id;
  // 🚨 تأكد إن اللي بيعدل هو صاحب التاسك أو أدمن
  const task = await Task.findById(req.params.id);

  if (!task) {
    return next(new AppError("Task not found", 404));
  }

  if (
    task.creator_id.toString() !== userId?.toString() &&
    user?.role !== "ADMIN"
  ) {
    return next(new AppError("Not authorized to update this task", 403));
  }

  const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ status: "success", data: { task: updatedTask } });
});

export const deleteTask = asyncWrap(async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;
  const userId = user?.id || user?._id;
  const task = await Task.findById(req.params.id);

  if (!task) {
    return next(new AppError("Task not found", 404));
  }

  if (
    task.creator_id.toString() !== userId?.toString() &&
    user?.role !== "ADMIN"
  ) {
    return next(new AppError("Not authorized to delete this task", 403));
  }

  await task.deleteOne();

  res
    .status(200)
    .json({ status: "success", message: "Task deleted successfully" });
});
