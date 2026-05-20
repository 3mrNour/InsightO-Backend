import { Router } from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import { asyncWrap } from "../../middlewares/asyncWrap.js";
import Task from "../task/task.model.js";
import StudentProfile from "../profile/model/StudentProfile.js";
import TaskSubmission from "../taskSubmittion/taskSubmittion.model.js";

const router = Router();

router.get("/surveys/pending", protect, asyncWrap(async (req, res) => {
  const user = (req as any).user;
  const userId = user.id || user._id;

  if (user.role !== "STUDENT") {
    return res.status(200).json({
      status: "success",
      count: 0,
      data: { surveys: [] }
    });
  }

  const studentProfile = await StudentProfile.findOne({ userId });
  if (!studentProfile) {
    return res.status(200).json({
      status: "success",
      count: 0,
      data: { surveys: [] }
    });
  }

  // Find active tasks / surveys
  const tasks = await Task.find({
    $or: [
      { "target.specific_users": userId },
      { "target.course_id": { $in: studentProfile.enrolledCourses } },
      { "target.department_id": studentProfile.departmentId }
    ],
    status: "ACTIVE"
  }).populate("target.course_id creator_id");

  // Find submissions
  const submissions = await TaskSubmission.find({ submitter_id: userId });
  const submittedTaskIds = submissions.map(s => s.task_id.toString());

  // Filter pending tasks
  const pendingTasks = tasks.filter(t => !submittedTaskIds.includes(t._id.toString()));

  res.status(200).json({
    status: "success",
    count: pendingTasks.length,
    data: { surveys: pendingTasks }
  });
}));

export default router;
