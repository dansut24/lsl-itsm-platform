import nodemailer from 'nodemailer'

function smtpConfig() {
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASSWORD || ''
  const host = process.env.SMTP_HOST || 'smtp.ionos.co.uk'

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured before verification email can be sent.')
  }

  return {
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function verificationEmailHtml({ name, companyName, verificationUrl, tenantUrl }) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#10213f">
    <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f3f6fb">
      <tr>
        <td align="center">
          <table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dfe6ef;border-radius:16px;overflow:hidden">
            <tr><td style="padding:28px 32px;background:#10213f;color:#ffffff;font-size:20px;font-weight:700">Hi5Central</td></tr>
            <tr>
              <td style="padding:32px">
                <div style="font-size:14px;color:#5d6b82;margin-bottom:12px">Verify your workspace</div>
                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">Welcome to Hi5Central, ${escapeHtml(name)}.</h1>
                <p style="font-size:16px;line-height:1.6;margin:0 0 18px">Your workspace for <strong>${escapeHtml(companyName)}</strong> has been reserved. Verify this email address to activate the tenant and continue setup.</p>
                <p style="margin:26px 0"><a href="${verificationUrl}" style="display:inline-block;background:#f59e0b;color:#10213f;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px">Verify email and continue</a></p>
                <p style="font-size:14px;line-height:1.6;color:#5d6b82;margin:0 0 12px">This link expires in 24 hours and can only be used once.</p>
                <p style="font-size:14px;line-height:1.6;color:#5d6b82;margin:0">Your workspace: ${escapeHtml(tenantUrl)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendVerificationEmail({ to, name, companyName, token, tenantUrl }) {
  const transporter = nodemailer.createTransport(smtpConfig())
  const apiBase = process.env.API_URL || 'https://api.hi5central.com'
  const verificationUrl = `${apiBase}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`
  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  return transporter.sendMail({
    from,
    to,
    subject: `Verify your ${companyName} Hi5Central workspace`,
    text: [
      `Hi ${name},`,
      '',
      `Your Hi5Central workspace for ${companyName} has been reserved.`,
      `Verify your email and continue setup: ${verificationUrl}`,
      '',
      `This link expires in 24 hours and can only be used once.`,
      `Workspace: ${tenantUrl}`,
    ].join('\n'),
    html: verificationEmailHtml({ name, companyName, verificationUrl, tenantUrl }),
  })
}

export async function verifySmtpConnection() {
  const transporter = nodemailer.createTransport(smtpConfig())
  await transporter.verify()
  return true
}
