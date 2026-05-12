import { Router } from "express";
import { protect, authorizeRoles } from "../../middlewares/authMiddleware.js";
import {
  createCycle,
  getCycles,
  updateCycle,
  deleteCycle,
} from "./cycle.controller.js";

const router = Router();

router.use(protect);

router.get("/", getCycles);
router.post("/", authorizeRoles("ADMIN", "HOD"), createCycle);
router.patch("/:id", authorizeRoles("ADMIN", "HOD"), updateCycle);
router.delete("/:id", authorizeRoles("ADMIN", "HOD"), deleteCycle);

export default router;
