import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder_init');

export type EmailOtpSender = (email: string, otp: string) => Promise<void>;

export class EmailService {
  private static mockSender: EmailOtpSender | null = null;

  public static setEmailSender(sender: EmailOtpSender | null): void {
    EmailService.mockSender = sender;
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
}
