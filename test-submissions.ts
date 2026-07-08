import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/insighto").then(async () => {
  const Form = (await import("./modules/form/model/formSchema.js")).default;
  const form = await Form.findById("6a4e2fbd960753a0f2a01df2");
  console.log("Form:", JSON.stringify(form, null, 2));
  process.exit(0);
});
