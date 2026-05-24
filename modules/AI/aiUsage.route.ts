import { Router } from "express";
import {
  getMyUsage,
  getAllUsersUsageAdmin,
  getTokenUsage,
  getAdminTokenUsage,
} from "./aiUsage.controller.js";
import { protect, authorizeRoles } from "../../middlewares/authMiddleware.js";

const router = Router();

// ─── Existing endpoints (unchanged paths) ────────────────────────────────────
router.get("/me", protect, authorizeRoles("INSTRUCTOR", "HOD", "ADMIN"), getMyUsage);
router.get("/users", protect, authorizeRoles("ADMIN"), getAllUsersUsageAdmin);

export default router;
