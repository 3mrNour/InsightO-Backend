// src/utils/taskNotifier.ts
import StudentProfile from "../modules/profile/model/StudentProfile.js";
import Course from "../modules/course/course.model.js"; // 👈 استدعاء موديل الكورس
import sendEmail from "./Email.js";

export const broadcastTaskToStudents = async (courseId: string, taskTitle: string, taskDesc: string, deadline: Date) => {
  try {
    // 1. جلب بيانات الكورس واسم المحاضر
    const course = await Course.findById(courseId).populate("instructorId", "firstName lastName");
    if (!course) return;

    const courseName = course.name;
    const instructor = course.instructorId as any;
    const instructorName = instructor ? `${instructor.firstName} ${instructor.lastName}` : "Assigned Instructor";

    // 2. جلب الطلبة المسجلين
    const enrolledStudents = await StudentProfile.find({ enrolledCourses: courseId })
      .populate("userId", "firstName lastName email");

    if (enrolledStudents.length === 0) return;

    // 3. إرسال إيميل مخصص لكل طالب (Loop)
    // نستخدم for...of عشان نبعتهم بالترتيب وميحصلش Block للـ SMTP لو العدد كبير
    for (const profile of enrolledStudents) {
      const student = profile.userId as any;
      if (!student || !student.email) continue;

      const studentName = student.firstName; // 👈 اسم الطالب

      // 4. بناء قالب الـ HTML الفخم والمخصص
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: 'Inter', Arial, sans-serif;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="padding: 40px 0;">
                <tr>
                    <td align="center">
                        <table width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e1e8f0;">
                            <tr>
                                <td align="center" style="padding: 32px 0 20px;">
                                    <div style="font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">
                                        <span style="color: #4f46e5;">insight</span>O
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 0 40px 40px;">
                                    
                                    <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                                        Hello, ${studentName}! 👋
                                    </h2>
                                    <p style="font-size: 15px; color: #64748b; line-height: 1.5; margin-bottom: 24px;">
                                        Prof. <b>${instructorName}</b> has just provisioned a new assignment for <b>${courseName}</b> that requires your attention.
                                    </p>
                                    
                                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                                        <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #0f172a;">${taskTitle}</h3>
                                        <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; font-style: italic;">"${taskDesc || 'No description provided.'}"</p>
                                        
                                        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-top: 16px;">
                                            <div style="font-size: 11px; font-weight: bold; color: #dc2626; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Deadline</div>
                                            <div style="font-size: 14px; font-weight: bold; color: #991b1b;">
                                                ${new Date(deadline).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div style="text-align: center;">
                                        <a href="http://localhost:5173/dashboard/student-courses/${courseId}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 14px 28px; font-weight: bold; font-size: 14px; text-decoration: none; border-radius: 8px;">
                                            View Assignment
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
      `;

      await sendEmail({
        email: student.email, // هنا بنبعت إيميل لكل طالب لوحده
        subject: `📚 New Task in ${courseName}: ${taskTitle}`, // عنوان الإيميل بقى فيه اسم الكورس
        html: emailHtml
      });
    }
    
    console.log(`✅ Successfully broadcasted personalized emails to ${enrolledStudents.length} students.`);
  } catch (error) {
    console.error("❌ Failed to broadcast task email:", error);
  }
};