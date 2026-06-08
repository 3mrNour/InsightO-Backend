import { Router } from "express";
import { protect, authorizeRoles } from "../../middlewares/authMiddleware.js";
import { getProfileAnalytics, getInstructorInsights } from "./profile.controller.js";

const router = Router();

// Route: GET /api/users/:userId/profile-analytics
router.get("/:userId/profile-analytics", protect, authorizeRoles("ADMIN", "HOD", "INSTRUCTOR", "STUDENT"), getProfileAnalytics);
// Route: GET /api/users/:userId/insights
router.get("/:id/insights", protect, getInstructorInsights);

export default router;
