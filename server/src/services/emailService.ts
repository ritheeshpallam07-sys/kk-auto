import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder_init');

export type EmailOtpSender = (email: string, otp: string) => Promise<void>;
export type EmailResetSender = (email: string, resetLink: string) => Promise<void>;

export class EmailService {
  private static mockSender: EmailOtpSender | null = null;
  private static mockResetSender: EmailResetSender | null = null;

  public static setEmailSender(sender: EmailOtpSender | null): void {
    EmailService.mockSender = sender;
  }

  public static setResetSender(sender: EmailResetSender | null): void {
    EmailService.mockResetSender = sender;
  }

  public static async sendVerificationOtp(
    email: string,
    otp: string
  ): Promise<void> {
    if (EmailService.mockSender) {
      return EmailService.mockSender(email, otp);
    }

    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured.');
    }

    const { error } = await resend.emails.send({
      from: 'Kk_Auto <noreply@clik2go.in>',
      to: [email],
      subject: 'Kk_Auto Email Verification OTP',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Kk_Auto Email Verification</h2>
          <p>Your verification OTP is:</p>

          <h1 style="letter-spacing: 6px;">${otp}</h1>

          <p>This OTP will expire in 10 minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `
    });

    if (error) {
      throw new Error(error.message || 'Failed to send verification email.');
    }
  }

  public static async sendPasswordResetLink(
    email: string,
    resetLink: string
  ): Promise<void> {
    if (EmailService.mockResetSender) {
      return EmailService.mockResetSender(email, resetLink);
    }

    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured.');
    }

    const { error } = await resend.emails.send({
      from: 'Kk_Auto <noreply@clik2go.in>',
      to: [email],
      subject: 'Reset Your Clik2Go Password',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px; background: #0B0B0D; color: #FFFFFF; border-radius: 16px;">
          <div style="margin-bottom: 24px; text-align: center;">
            <h2 style="color: #FFFFFF; margin: 0 0 8px 0; font-size: 24px; font-weight: 800;">Clik2Go Account Recovery</h2>
            <p style="color: #A1A1AA; font-size: 14px; margin: 0;">We received a request to reset the password for your account.</p>
          </div>

          <div style="background: #171719; border: 1px solid #303034; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="color: #E4E4E7; font-size: 14px; margin-bottom: 20px;">
              Click the button below to choose a new password. This link is single-use and will expire in <strong>15 minutes</strong>.
            </p>
            <a href="${resetLink}" style="display: inline-block; background-color: #C6FF3D; color: #0B0B0D; font-weight: 800; font-size: 14px; padding: 12px 28px; border-radius: 10px; text-decoration: none; text-transform: uppercase; letter-spacing: 0.5px;">
              Reset Password
            </a>
            <p style="color: #71717A; font-size: 12px; margin-top: 20px; word-break: break-all;">
              If the button doesn't work, copy and paste this URL into your browser:<br/>
              <span style="color: #A1A1AA;">${resetLink}</span>
            </p>
          </div>

          <div style="border-top: 1px solid #27272A; padding-top: 16px; font-size: 12px; color: #71717A; text-align: center;">
            <p style="margin: 0 0 8px 0;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            <p style="margin: 0;">Clik2Go — Safe, Reliable Auto Booking</p>
          </div>
        </div>
      `
    });

    if (error) {
      throw new Error(error.message || 'Failed to send password reset email.');
    }
  }
}
