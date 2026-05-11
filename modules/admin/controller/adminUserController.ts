import type { NextFunction, Request, Response } from 'express';
import mongoose, { type Types } from 'mongoose';
import User from '../../auth/model/User_Schema.js';
import StudentProfile, { type IStudentProfile } from '../../profile/model/StudentProfile.js';
import InstructorProfile, { type IInstructorProfile } from '../../profile/model/InstructorProfile.js';
import HODProfile, { type IHODProfile } from '../../profile/model/HODProfile.js';
import Department from '../../department/model/Department.js';
import Course from '../../course/course.model.js';
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
  session?: mongoose.ClientSession,
) => {
  if (role === UserSchema.STUDENT) {
    await StudentProfile.deleteOne({ userId }, session ? { session } : {});
    return;
  }
  if (role === UserSchema.INSTRUCTOR) {
    await InstructorProfile.deleteOne({ userId }, session ? { session } : {});
    return;
  }
  if (role === UserSchema.HOD) {
    await HODProfile.deleteOne({ userId }, session ? { session } : {});
  }
};

const createOrUpdateProfileByRole = async (
  role: string,
  userId: Types.ObjectId,
  data: { academicYear?: number; departmentId?: string | Types.ObjectId },
  session: mongoose.ClientSession,
) => {
  if (role === UserSchema.STUDENT) {
    if (typeof data.academicYear !== 'number') {
      throw new AppError('academicYear is required for STUDENT role', 400);
    }
    if (!data.departmentId) {
      throw new AppError('departmentId is required for STUDENT role', 400);
    }
    const department = await Department.findById(data.departmentId).session(session);
    if (!department) {
      throw new AppError('departmentId is invalid or department does not exist', 400);
    }
    await StudentProfile.findOneAndUpdate(
      { userId },
      { $set: { academicYear: data.academicYear, departmentId: data.departmentId } },
      { new: true, upsert: true, session, setDefaultsOnInsert: true },
    );
    return;
  }

  if (role === UserSchema.INSTRUCTOR) {
    if (!data.departmentId) {
      throw new AppError('departmentId is required for INSTRUCTOR role', 400);
    }
    const department = await Department.findById(data.departmentId).session(session);
    if (!department) {
      throw new AppError('departmentId is invalid or department does not exist', 400);
    }
    await InstructorProfile.findOneAndUpdate(
      { userId },
      { $set: { departmentId: data.departmentId } },
      { new: true, upsert: true, session, setDefaultsOnInsert: true },
    );
    return;
  }

  if (role === UserSchema.HOD) {
    if (!data.departmentId) {
      throw new AppError('departmentId is required for HOD role', 400);
    }
    const department = await Department.findById(data.departmentId).session(session);
    if (!department) {
      throw new AppError('departmentId is invalid or department does not exist', 400);
    }
    await HODProfile.findOneAndUpdate(
      { userId },
      { $set: { departmentId: data.departmentId } },
      { new: true, upsert: true, session, setDefaultsOnInsert: true },
    );
  }
};

export const createAdminUser = asyncWrap(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { firstName, lastName, email, password, nationalId, role, departmentId, academicYear } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({ $or: [{ email }, { nationalId }] }).session(session);
    if (existingUser) {
      throw new AppError('Email or National ID is already registered', 409);
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const newUser = await User.create([{
      firstName,
      lastName,
      email,
      password: hashedPassword,
      nationalId,
      role,
      isActive: true,
      isVerified: true,
    }], { session });

    // Create corresponding profile based on role
    if (role === UserSchema.STUDENT) {
      await StudentProfile.create([{
        userId: newUser[0]._id,
        departmentId,
        academicYear,
        enrolledCourses: [],
      }], { session });
    } else if (role === UserSchema.INSTRUCTOR) {
      await InstructorProfile.create([{
        userId: newUser[0]._id,
        departmentId,
        teachingCourses: [],
      }], { session });
    } else if (role === UserSchema.HOD) {
      await HODProfile.create([{
        userId: newUser[0]._id,
        departmentId,
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    const userResponse = await mapUserWithProfile(newUser[0].toObject());

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: userResponse
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { firstName, lastName, email, role, isActive, academicYear, departmentId } = req.body;
    const user = await User.findById(req.params.id).session(session);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const oldRole = user.role;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (isActive !== undefined) user.isActive = isActive;
    if (role !== undefined) user.role = role;
    await user.save({ session });

    if (oldRole !== user.role) {
      await removeProfileByRole(oldRole, user._id, session);
    }

    if ([UserSchema.STUDENT, UserSchema.INSTRUCTOR, UserSchema.HOD].includes(user.role as UserSchema)) {
      await createOrUpdateProfileByRole(
        user.role,
        user._id,
        { academicYear, departmentId },
        session,
      );
    }

    await session.commitTransaction();
    session.endSession();

    const updatedUser = (await User.findById(user._id).select('-password -otp -otpExpires').lean()) as IUserLean | null;
    const payload = updatedUser ? await mapUserWithProfile(updatedUser) : null;
    res.status(200).json({ status: 'success', data: payload });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const deleteAdminUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(req.params.id).session(session);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    await removeProfileByRole(user.role, user._id, session);
    await User.deleteOne({ _id: user._id }, { session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ status: 'success', message: 'User and related profile deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};
