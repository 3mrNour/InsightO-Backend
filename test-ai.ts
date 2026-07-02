import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from './modules/auth/model/User_Schema.js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: 'instructor1@ins.com' }); // or any instructor
  if (!user) {
    console.log("No user found");
    process.exit(1);
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '1h' }
  );

  console.log("Got token for", user.email);

  try {
    const res = await axios.post(
      'http://localhost:5000/api/ai/generate-form',
      { prompt: "Generate a quiz about math" },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Success:", res.data);
  } catch (err) {
    console.log("Error:", err.response?.status, err.response?.data || err.message);
  }

  process.exit(0);
}

test();
