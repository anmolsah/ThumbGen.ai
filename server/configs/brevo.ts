import * as Brevo from "@getbrevo/brevo";

const apiInstance = new Brevo.TransactionalEmailsApi();

// Set API key authentication (cast to any for TypeScript compatibility per Brevo docs)
(apiInstance as any).authentications.apiKey.apiKey = process.env
  .BREVO_API_KEY as string;

export const sendOtpEmail = async (
  email: string,
  otp: string,
  name: string
) => {
  const sendSmtpEmail = new Brevo.SendSmtpEmail();

  sendSmtpEmail.subject = "Verify your email - ThumbGen";
  sendSmtpEmail.htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0d9488;">Welcome to ThumbGen!</h2>
            <p>Hi ${name},</p>
            <p>Your verification code is:</p>
            <div style="background: linear-gradient(135deg, #0d9488, #06b6d4); color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 20px 0;">
                ${otp}
            </div>
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #6b7280; font-size: 12px;">© ${new Date().getFullYear()} ThumbGen. All rights reserved.</p>
        </div>
    `;
  sendSmtpEmail.sender = {
    name: "ThumbGen",
    email: process.env.BREVO_SENDER_EMAIL as string,
  };
  sendSmtpEmail.to = [{ email, name }];

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Email sent successfully:", result);
    return true;
  } catch (error: any) {
    console.error(
      "Brevo email error:",
      error?.response?.body || error.message || error
    );
    throw error;
  }
};
