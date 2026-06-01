import nodemailer from 'nodemailer'

type PasswordResetEmailPayload = {
  to: string
  fullName?: string | null
  actionLink: string
}

type NotificationEmailPayload = {
  to: string
  fullName?: string | null
  title: string
  body: string
  actionUrl?: string | null
  actionLabel?: string | null
}

type SmtpSettings = {
  host: string
  port: number
  user: string
  pass: string
  fromEmail: string
  fromName: string
  secure: boolean
}

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback
  if (!value?.trim()) {
    throw new Error(`Configura??o SMTP ausente: ${name}.`)
  }

  return value.trim()
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback
  }

  return ['1', 'true', 'yes', 'sim', 'ssl', 'tls'].includes(value.trim().toLowerCase())
}

export function getSmtpSettings(): SmtpSettings {
  const host = requireEnv('SMTP_HOST')
  const port = Number.parseInt(process.env.SMTP_PORT ?? '465', 10)

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('Configura??o SMTP invalida: SMTP_PORT.')
  }

  return {
    host,
    port,
    user: requireEnv('SMTP_USER'),
    pass: requireEnv('SMTP_PASSWORD'),
    fromEmail: requireEnv('SMTP_FROM_EMAIL', process.env.SMTP_USER),
    fromName: process.env.SMTP_FROM_NAME?.trim() || 'GenFlix',
    secure: parseBoolean(process.env.SMTP_SECURE, port === 465),
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function createTransporter(settings: SmtpSettings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.pass,
    },
  })
}

function formatFrom(settings: SmtpSettings) {
  return `"${settings.fromName.replace(/"/g, '\\"')}" <${settings.fromEmail}>`
}

function createPasswordResetHtml(payload: PasswordResetEmailPayload) {
  const safeName = escapeHtml(payload.fullName?.trim() || 'estudante')
  const safeLink = escapeHtml(payload.actionLink)

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Redefina sua senha</title>
  </head>
  <body style="margin:0;background:#F4F8F9;color:#15323b;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F8F9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #D8E6EB;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#1398B7 0%,#0A3640 100%);padding:28px 32px;color:#ffffff;">
                <div style="font-size:13px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;">GenFlix</div>
                <h1 style="margin:14px 0 0;font-size:28px;line-height:1.15;font-weight:800;">Redefina sua senha</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Olá, ${safeName}.</p>
                <p style="margin:0 0 22px;font-size:16px;line-height:1.6;">
                  Recebemos uma solicitação para redefinir a senha da sua conta GenFlix. Clique no botão abaixo para criar uma nova senha.
                </p>
                <p style="margin:28px 0;text-align:center;">
                  <a href="${safeLink}" style="display:inline-block;background:#1398B7;color:#ffffff;text-decoration:none;border-radius:6px;padding:14px 22px;font-size:15px;font-weight:800;">
                    Redefinir senha
                  </a>
                </p>
                <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#5F7077;">
                  Se o botão não funcionar, copie e cole este link no navegador:
                </p>
                <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.6;color:#1398B7;">${safeLink}</p>
                <hr style="border:none;border-top:1px solid #D8E6EB;margin:28px 0;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#5F7077;">
                  Se você não solicitou esta redefinição, ignore este e-mail. Sua senha atual continuará ativa.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function createPasswordResetText(payload: PasswordResetEmailPayload) {
  const name = payload.fullName?.trim() || 'estudante'
  return [
    `Ola, ${name}.`,
    '',
    'Recebemos uma solicitacao para redefinir a senha da sua conta GenFlix.',
    'Acesse o link abaixo para criar uma nova senha:',
    '',
    payload.actionLink,
    '',
    'Se voc? n?o solicitou esta redefinicao, ignore este e-mail.',
  ].join('\n')
}

export async function sendPasswordResetEmail(payload: PasswordResetEmailPayload) {
  const settings = getSmtpSettings()
  const transporter = createTransporter(settings)

  await transporter.sendMail({
    from: formatFrom(settings),
    to: payload.to,
    subject: 'Redefina sua senha na GenFlix',
    text: createPasswordResetText(payload),
    html: createPasswordResetHtml(payload),
  })
}

function createNotificationHtml(payload: NotificationEmailPayload) {
  const safeName = escapeHtml(payload.fullName?.trim() || 'estudante')
  const safeTitle = escapeHtml(payload.title)
  const safeBody = escapeHtml(payload.body).replace(/\n/g, '<br>')
  const safeActionUrl = payload.actionUrl ? escapeHtml(payload.actionUrl) : null
  const safeActionLabel = escapeHtml(payload.actionLabel?.trim() || 'Acessar GenFlix')

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#F2F7F9;color:#15323b;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F2F7F9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #D8E6EB;">
            <tr>
              <td style="background:linear-gradient(180deg,#1398B7 0%,#0A3640 100%);padding:30px 34px;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:.24em;text-transform:uppercase;font-weight:800;">GenFlix</div>
                <h1 style="margin:14px 0 0;font-size:28px;line-height:1.18;font-weight:800;">${safeTitle}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 34px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Olá, ${safeName}.</p>
                <p style="margin:0 0 22px;font-size:16px;line-height:1.7;">${safeBody}</p>
                ${safeActionUrl ? `
                <p style="margin:28px 0;text-align:center;">
                  <a href="${safeActionUrl}" style="display:inline-block;background:#1398B7;color:#ffffff;text-decoration:none;padding:14px 22px;font-size:15px;font-weight:800;">
                    ${safeActionLabel}
                  </a>
                </p>
                <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#5F7077;">Se o botão não funcionar, copie e cole este link no navegador:</p>
                <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.6;color:#1398B7;">${safeActionUrl}</p>
                ` : ''}
                <hr style="border:none;border-top:1px solid #D8E6EB;margin:28px 0;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#5F7077;">
                  Você recebeu esta mensagem porque suas preferências permitem notificações por e-mail na GenFlix.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function createNotificationText(payload: NotificationEmailPayload) {
  const lines = [
    `Olá, ${payload.fullName?.trim() || 'estudante'}.`,
    '',
    payload.title,
    '',
    payload.body,
  ]

  if (payload.actionUrl) {
    lines.push('', payload.actionLabel?.trim() || 'Acessar GenFlix', payload.actionUrl)
  }

  lines.push('', 'Você recebeu esta mensagem porque suas preferências permitem notificações por e-mail na GenFlix.')

  return lines.join('\n')
}

export async function sendNotificationEmail(payload: NotificationEmailPayload) {
  const settings = getSmtpSettings()
  const transporter = createTransporter(settings)
  const info = await transporter.sendMail({
    from: formatFrom(settings),
    to: payload.to,
    subject: payload.title,
    text: createNotificationText(payload),
    html: createNotificationHtml(payload),
  })

  return info.messageId
}
