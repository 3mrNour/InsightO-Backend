import mongoose from "mongoose";

export const dbConnection = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not defined in environment variables");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected!`);
  } catch (err) {
    const error = err as Error;
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};
