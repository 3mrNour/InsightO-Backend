import type { NextFunction, Request, Response } from 'express';
import { type Types } from 'mongoose';
import User from '../../auth/model/User_Schema.js';
import StudentProfile, { type IStudentProfile } from '../../profile/model/StudentProfile.js';
import InstructorProfile, { type IInstructorProfile } from '../../profile/model/InstructorProfile.js';
import HODProfile, { type IHODProfile } from '../../profile/model/HODProfile.js';
import Department from '../../department/model/Department.js';
import { AppError } from '../../../utils/AppError.js';
import { UserSchema } from '../../../utils/User.js';
import bcryptjs from 'bcryptjs';
import { asyncWrap } from '../../../middlewares/asyncWrap.js';

type UserRole = `${UserSchema}`;
type ProfileDoc = IStudentProfile | IInstructorProfile | IHODProfile | null;

interface IUserLean {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  nationalId: number;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ProfileResponse {
  id: string;
  data: Record<string, unknown>;
}

interface UserListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  nationalId: number;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  profile: ProfileResponse | null;
}

interface UserDetailResponse extends UserListItem {}

const normalizeId = (id: Types.ObjectId | string): string => id.toString();

const getProfileByRole = async (
  role: string,
  userId: Types.ObjectId,
): Promise<ProfileDoc> => {
  if (role === UserSchema.STUDENT) {
    return StudentProfile.findOne({ userId })
      .populate('departmentId')
      .populate('enrolledCourses')
      .lean();
  }
  if (role === UserSchema.INSTRUCTOR) {
    return InstructorProfile.findOne({ userId })
      .populate('departmentId')
      .populate('teachingCourses')
      .lean();
  }
  if (role === UserSchema.HOD) {
    return HODProfile.findOne({ userId }).populate('departmentId').lean();
  }
  return null;
};

const mapUserWithProfile = async (user: IUserLean): Promise<UserListItem> => {
  const profile = await getProfileByRole(user.role, user._id);
  const profileData = profile ? (profile as unknown as Record<string, unknown>) : null;
  const profileId = profile ? normalizeId((profile as unknown as { _id: Types.ObjectId })._id) : null;
  return {
    id: normalizeId(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    nationalId: user.nationalId,
    role: user.role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: profileData && profileId ? { id: profileId, data: profileData } : null,
  };
};

const removeProfileByRole = async (
  role: string,
  userId: Types.ObjectId,
) => {
  if (role === UserSchema.STUDENT) {
    await StudentProfile.deleteOne({ userId });
    return;
  }
  if (role === UserSchema.INSTRUCTOR) {
    await InstructorProfile.deleteOne({ userId });
    return;
  }
  if (role === UserSchema.HOD) {
    await HODProfile.deleteOne({ userId });
  }
};

const createOrUpdateProfileByRole = async (
  role: string,
  userId: Types.ObjectId,
  data: { academicYear?: number; departmentId?: string | Types.ObjectId },
) => {
  if (role === UserSchema.STUDENT) {
    if (typeof data.academicYear !== 'number') {
      throw new AppError('academicYear is required for STUDENT role', 400);
    }
    if (!data.departmentId) {
      throw new AppError('departmentId is required for STUDENT role', 400);
    }
    const department = await Department.findById(data.departmentId);
    if (!department) {
      throw new AppError('departmentId is invalid or department does not exist', 400);
    }
    await StudentProfile.findOneAndUpdate(
      { userId },
      { $set: { academicYear: data.academicYear, departmentId: data.departmentId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return;
  }

  if (role === UserSchema.INSTRUCTOR) {
    if (!data.departmentId) {
      throw new AppError('departmentId is required for INSTRUCTOR role', 400);
    }
    const department = await Department.findById(data.departmentId);
    if (!department) {
      throw new AppError('departmentId is invalid or department does not exist', 400);
    }
    await InstructorProfile.findOneAndUpdate(
      { userId },
      { $set: { departmentId: data.departmentId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return;
  }

  if (role === UserSchema.HOD) {
    if (!data.departmentId) {
      throw new AppError('departmentId is required for HOD role', 400);
    }
    const department = await Department.findById(data.departmentId);
    if (!department) {
      throw new AppError('departmentId is invalid or department does not exist', 400);
    }
    await HODProfile.findOneAndUpdate(
      { userId },
      { $set: { departmentId: data.departmentId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }
};

export const createAdminUser = asyncWrap(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { firstName, lastName, email, password, nationalId, role, departmentId, academicYear } = req.body;

  // Check for existing user
  const existingUser = await User.findOne({ $or: [{ email }, { nationalId }] });
  if (existingUser) {
    return next(new AppError('Email or National ID is already registered', 409));
  }

  // Validate departmentId exists before creating anything
  if ([UserSchema.STUDENT, UserSchema.INSTRUCTOR, UserSchema.HOD].includes(role as UserSchema)) {
    if (!departmentId) {
      return next(new AppError('departmentId is required for this role', 400));
    }
    const departmentExists = await Department.findById(departmentId);
    if (!departmentExists) {
      return next(new AppError('departmentId is invalid or department does not exist', 400));
    }
  }

  if (role === UserSchema.STUDENT && typeof academicYear !== 'number') {
    return next(new AppError('academicYear is required and must be a number for STUDENT role', 400));
  }

  const hashedPassword = await bcryptjs.hash(password, 10);

  // Step 1: Create the User document
  let createdUser: InstanceType<typeof User> | null = null;
  try {
    createdUser = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      nationalId,
      role,
      isActive: true,
      isVerified: true,
    });
  } catch (userErr) {
    return next(userErr);
  }

  // Step 2: Create the role-specific profile (with manual rollback on failure)
  try {
    if (role === UserSchema.STUDENT) {
      await StudentProfile.create({
        userId: createdUser._id,
        departmentId,
        academicYear,
        enrolledCourses: [],
      });
    } else if (role === UserSchema.INSTRUCTOR) {
      await InstructorProfile.create({
        userId: createdUser._id,
        departmentId,
        teachingCourses: [],
      });
    } else if (role === UserSchema.HOD) {
      await HODProfile.create({
        userId: createdUser._id,
        departmentId,
      });
    }
  } catch (profileErr) {
    // Rollback: remove the already-created user to keep data consistent
    await User.deleteOne({ _id: createdUser._id }).catch(() => {});
    return next(profileErr);
  }

  const userResponse = await mapUserWithProfile(createdUser.toObject());

  res.status(201).json({
    status: 'success',
    message: 'User created successfully',
    data: userResponse,
  });
});

export const listAdminUsers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = (await User.find().select('-password -otp -otpExpires').lean()) as IUserLean[];
    const payload = await Promise.all(users.map((user) => mapUserWithProfile(user)));
    res.status(200).json({ status: 'success', data: payload });
  } catch (error) {
    next(error);
  }
};

export const getAdminUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (await User.findById(req.params.id).select('-password -otp -otpExpires').lean()) as IUserLean | null;
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    const payload: UserDetailResponse = await mapUserWithProfile(user);
    res.status(200).json({ status: 'success', data: payload });
  } catch (error) {
    next(error);
  }
};

export const updateAdminUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, email, role, isActive, academicYear, departmentId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const oldRole = user.role;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (isActive !== undefined) user.isActive = isActive;
    if (role !== undefined) user.role = role;
    await user.save();

    // If role changed, remove the old profile
    if (oldRole !== user.role) {
      await removeProfileByRole(oldRole, user._id);
    }

    // Create or update profile for roles that have one
    if ([UserSchema.STUDENT, UserSchema.INSTRUCTOR, UserSchema.HOD].includes(user.role as UserSchema)) {
      await createOrUpdateProfileByRole(
        user.role,
        user._id,
        { academicYear, departmentId },
      );
    }

    const updatedUser = (await User.findById(user._id).select('-password -otp -otpExpires').lean()) as IUserLean | null;
    const payload = updatedUser ? await mapUserWithProfile(updatedUser) : null;
    res.status(200).json({ status: 'success', data: payload });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Remove role-specific profile first, then remove user
    await removeProfileByRole(user.role, user._id);
    await User.deleteOne({ _id: user._id });

    res.status(200).json({ status: 'success', message: 'User and related profile deleted successfully' });
  } catch (error) {
    next(error);
  }
};
