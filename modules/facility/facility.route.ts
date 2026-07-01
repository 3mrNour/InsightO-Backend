import { Router } from "express";
import {
  createFacility,
  getFacilities,
  getFacilityById,
  updateFacility,
  deleteFacility,
  getFacilityInsights,
} from "./facility.controller.js";
import { protect, authorizeRoles } from "../../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);

router
  .route("/")
  .get(authorizeRoles("ADMIN", "HOD", "INSTRUCTOR", "DEPARTMENT"), getFacilities)
  .post(authorizeRoles("ADMIN"), createFacility);

router
  .route("/:id")
  .get(authorizeRoles("ADMIN", "HOD", "INSTRUCTOR", "DEPARTMENT"), getFacilityById)
  .patch(authorizeRoles("ADMIN"), updateFacility)
  .delete(authorizeRoles("ADMIN"), deleteFacility);

router.get("/:id/insights", authorizeRoles("ADMIN", "HOD", "INSTRUCTOR", "DEPARTMENT"), getFacilityInsights);

export default router;
