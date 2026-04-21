import express from "express";
import {
  createForm,
  getAllForms,
  getFormById,
  deleteForm,
  updateFormSettings
} from "../controller/formControler.js";



import { protect, authorizeRoles } from "../../../middlewares/authMiddleware.js";
import { validate } from "../../../middlewares/validateMiddleware.js";
import { createFormSchema } from "../validator/formValidation.js";
import { UserSchema } from "../../../utils/User.js";

const router = express.Router();


router.post(
  "/",
  protect,
  authorizeRoles(UserSchema.ADMIN,UserSchema.HEAD_OF_DEP , UserSchema.INSTRUCTOR),
  validate(createFormSchema),
  createForm
);

router.get("/", protect, getAllForms);
router.get("/:id", protect, getFormById);
router.delete("/:id", protect, authorizeRoles(UserSchema.HEAD_OF_DEP,UserSchema.INSTRUCTOR), deleteForm);
router.patch("/:id/settings", protect, authorizeRoles(UserSchema.HEAD_OF_DEP,UserSchema.INSTRUCTOR) ,updateFormSettings);



export default router;