import nodemailer from "nodemailer";
import { google } from "googleapis";

interface EmailOptions {
  email: string;
  subject: string;
  message: string;
}

const sendEmail = async (options: EmailOptions) => {
  const emailUser = process.env.EMAIL_USERNAME;
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.OAUTH_REFRESH_TOKEN;

  if (!emailUser || !clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing OAuth env vars. Required: EMAIL_USERNAME, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN"
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "https://developers.google.com/oauthplayground");
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const tokenResponse = await oauth2Client.getAccessToken();
  const accessToken = tokenResponse.token;

  if (!accessToken) {
    throw new Error("Failed to generate OAuth access token from refresh token");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: emailUser,
      clientId,
      clientSecret,
      refreshToken,
      accessToken,
    },
  });

  const mailOptions = {
    from: `insightO Team <${emailUser}>`,
    to: options.email,
    subject: options.subject,
    html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: 'Inter', Arial, sans-serif;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 0;">
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
                        <td style="padding: 0 40px;">
                            <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; text-align: center; margin-bottom: 8px;">Verify your identity</h2>
                            <p style="font-size: 15px; color: #64748b; text-align: center; line-height: 1.5; margin-bottom: 32px;">
                                Use the code below to complete your sign-in. This code is valid for exactly <b>1 minute</b>.
                            </p>
                            
                            <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
                                <span style="font-size: 36px; font-weight: 900; color: #4f46e5; letter-spacing: 8px;">
                                    <b>${options.message}</b>
                                </span>
                            </div>

                            <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-bottom: 32px;">
                                If you didn't request this code, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="background-color: #0f172a; padding: 24px;">
                            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                                &copy; 2026 insightO Enterprise SaaS
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;
