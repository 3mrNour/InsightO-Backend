import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/insighto").then(async () => {
  const Form = (await import("./modules/form/model/formSchema.js")).default;
  const Submission = (await import("./modules/submission/submission.model.js")).default;

  const courseForms = await Form.find({ subject_role: "COURSE", course_id: { $exists: true, $ne: null } });
  console.log(`Found ${courseForms.length} course forms.`);
  let fixedCount = 0;

  for (const form of courseForms) {
    const subs = await Submission.find({ form_id: form._id });
    for (const sub of subs) {
      if (sub.subject_id && sub.subject_id.toString() !== form.course_id.toString()) {
        console.log(`Fixing submission ${sub._id}. Changing subject_id from ${sub.subject_id} to ${form.course_id}`);
        sub.subject_id = form.course_id;
        await sub.save();
        fixedCount++;
      }
    }
  }

  console.log(`Fixed ${fixedCount} submissions.`);
  process.exit(0);
});
