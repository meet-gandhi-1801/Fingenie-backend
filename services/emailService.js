const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTPEmail = async (email, otp, purpose = 'email-verification') => {
  try {
    const subject = purpose === 'password-reset'
      ? 'FinGenie — Password Reset OTP'
      : 'FinGenie — Verify Your Email';

    const message = purpose === 'password-reset'
      ? 'You requested a password reset.'
      : 'Welcome to FinGenie! Please verify your email.';

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9f9f9; border-radius: 12px;">
          <h1 style="color: #1a1a2e; font-size: 24px; margin-bottom: 8px;">
            Fin<span style="color: #4f46e5;">Genie</span> 💰
          </h1>
          <p style="color: #555; font-size: 15px;">${message}</p>
          <div style="background: #fff; border: 2px solid #4f46e5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <p style="color: #888; font-size: 13px; margin: 0 0 8px;">Your OTP code</p>
            <h2 style="color: #1a1a2e; font-size: 40px; letter-spacing: 12px; margin: 0;">
              ${otp}
            </h2>
          </div>
          <p style="color: #888; font-size: 13px;">
            This code expires in <strong>10 minutes</strong>. 
            Never share it with anyone.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #bbb; font-size: 12px;">
            If you didn't request this, ignore this email.
          </p>
        </div>
      `
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, data };

  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = { sendOTPEmail };