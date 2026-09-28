import { Resend } from 'resend';

let resendInstance: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Resend] Missing RESEND_API_KEY environment variable.');
    return null;
  }
  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export interface SendStaffInviteParams {
  to: string;
  recipientName: string;
  clinicName: string;
  roleName: string;
  inviteLink: string;
  inviterName?: string;
  branches?: string[];
  authCode?: string;
}

export async function sendStaffInvitationEmail({
  to,
  recipientName,
  clinicName,
  roleName,
  inviteLink,
  inviterName,
  branches,
  authCode,
}: SendStaffInviteParams) {
  const resend = getResendClient();
  if (!resend) {
    return {
      success: false,
      error: 'Email delivery service not configured (missing RESEND_API_KEY).',
    };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Healthiva <noreply@healthiva.in>';
  const cleanEmail = to.trim().toLowerCase();
  const branchListText = branches && branches.length > 0 ? branches.join(', ') : 'Primary Clinic Branch';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clinic Invitation - ${clinicName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #009fe3 0%, #007bb3 100%); padding: 32px 28px; text-align: center;">
              <div style="font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">HEALTHIVA</div>
              <div style="font-size: 12px; color: #e0f2fe; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; font-weight: 600;">Clinic Operating System</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <div style="font-size: 13px; font-weight: 700; color: #009fe3; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                Official Team Invitation
              </div>
              
              <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; line-height: 1.3;">
                Join ${clinicName} on Healthiva
              </h1>

              <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                Hello <strong>${recipientName}</strong>,
              </p>

              <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                You have been invited by ${inviterName ? `<strong>${inviterName}</strong>` : 'your clinic administrator'} to join the healthcare team at <strong>${clinicName}</strong> as a <strong>${roleName}</strong>.
              </p>

              <!-- Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="font-size: 13px; color: #64748b; padding-bottom: 8px;">Clinic:</td>
                  <td style="font-size: 13px; font-weight: 700; color: #0f172a; padding-bottom: 8px; text-align: right;">${clinicName}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; padding-bottom: 8px;">Assigned Role:</td>
                  <td style="font-size: 13px; font-weight: 700; color: #0284c7; padding-bottom: 8px; text-align: right;">${roleName}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b;">Assigned Branches:</td>
                  <td style="font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${branchListText}</td>
                </tr>
              </table>

              ${authCode ? `
              <!-- 6-Digit Verification Code -->
              <div style="background-color: #f0f9ff; border: 1.5px dashed #009fe3; border-radius: 14px; padding: 18px; text-align: center; margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 1px;">Invitation Verification Code</div>
                <div style="font-size: 30px; font-weight: 800; color: #009fe3; letter-spacing: 6px; margin: 8px 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${authCode}</div>
                <div style="font-size: 12px; color: #64748b; line-height: 1.4;">Enter this 6-digit code on the setup screen to verify your email and activate your account.</div>
              </div>
              ` : ''}

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}" target="_blank" style="display: inline-block; background-color: #009fe3; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 159, 227, 0.25);">
                      Accept Invitation & Join Clinic →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Secondary link fallback -->
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 12px; border: 1px dashed #cbd5e1; margin-bottom: 24px; font-size: 12px; color: #64748b; word-break: break-all;">
                <span style="font-weight: 600; color: #475569;">Direct Link:</span><br/>
                <a href="${inviteLink}" target="_blank" style="color: #009fe3; text-decoration: underline;">${inviteLink}</a>
              </div>

              <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                Notice: This secure invitation link will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8;">
              © ${new Date().getFullYear()} Healthiva Technologies • All rights reserved.<br/>
              Empowering smarter, modern healthcare clinics across India.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    let { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [cleanEmail],
      subject: `You've been invited to join ${clinicName} as a ${roleName} - Healthiva`,
      html: htmlContent,
      text: `Hello ${recipientName},\n\nYou have been invited to join the clinic team at ${clinicName} as a ${roleName}.\n\nClick the link below to accept your invitation and set your account password:\n${inviteLink}\n\nThis invitation link expires in 7 days.\n\nWarm regards,\n${clinicName}\nPowered by Healthiva`,
    });

    if (error && fromEmail !== 'Healthiva <onboarding@resend.dev>') {
      console.warn('[Resend primary sender retry with onboarding sender]:', error.message);
      const retryResult = await resend.emails.send({
        from: 'Healthiva <onboarding@resend.dev>',
        to: [cleanEmail],
        subject: `You've been invited to join ${clinicName} as a ${roleName} - Healthiva`,
        html: htmlContent,
        text: `Hello ${recipientName},\n\nYou have been invited to join the clinic team at ${clinicName} as a ${roleName}.\n\nClick the link below to accept your invitation and set your account password:\n${inviteLink}\n\nThis invitation link expires in 7 days.\n\nWarm regards,\n${clinicName}\nPowered by Healthiva`,
      });
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error('[Resend Send Error]:', error);
      return { success: false, error: error.message || 'Failed to send email via Resend' };
    }

    return { success: true, id: data?.id };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unexpected email delivery error';
    console.error('[Resend Catch Error]:', err);
    return { success: false, error: errorMsg };
  }
}

export interface SendPasswordResetParams {
  to: string;
  recipientName: string;
  clinicName: string;
  resetLink: string;
}

export async function sendPasswordResetEmail({
  to,
  recipientName,
  clinicName,
  resetLink,
}: SendPasswordResetParams) {
  const resend = getResendClient();
  if (!resend) {
    return {
      success: false,
      error: 'Email delivery service not configured (missing RESEND_API_KEY).',
    };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Healthiva <noreply@healthiva.in>';
  const cleanEmail = to.trim().toLowerCase();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - ${clinicName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #009fe3 0%, #007bb3 100%); padding: 32px 28px; text-align: center;">
              <div style="font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">HEALTHIVA</div>
              <div style="font-size: 12px; color: #e0f2fe; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; font-weight: 600;">Clinic Operating System</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <div style="font-size: 13px; font-weight: 700; color: #009fe3; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                Password Reset Request
              </div>
              
              <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; line-height: 1.3;">
                Reset Your Password for ${clinicName}
              </h1>

              <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                Hello <strong>${recipientName}</strong>,
              </p>

              <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                A password reset was requested for your staff account at <strong>${clinicName}</strong>. Click the button below to choose a new, secure password:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; background-color: #009fe3; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0, 159, 227, 0.35);">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 16px 0;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${resetLink}" style="color: #009fe3; word-break: break-all; font-size: 12px;">${resetLink}</a>
              </p>

              <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                ⏰ If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8;">
              © ${new Date().getFullYear()} Healthiva Technologies • All rights reserved.<br/>
              Empowering smarter, modern healthcare clinics across India.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [cleanEmail],
      subject: `Reset your Healthiva staff password - ${clinicName}`,
      html: htmlContent,
      text: `Hello ${recipientName},\n\nA password reset was requested for your account at ${clinicName}.\n\nClick the link below to choose a new password:\n${resetLink}\n\nWarm regards,\n${clinicName}\nPowered by Healthiva`,
    });

    if (error) {
      console.error('[Resend Password Reset Error]:', error);
      return { success: false, error: error.message || 'Failed to send password reset email via Resend' };
    }

    return { success: true, id: data?.id };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unexpected email delivery error';
    console.error('[Resend Catch Error]:', err);
    return { success: false, error: errorMsg };
  }
}

