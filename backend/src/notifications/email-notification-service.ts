import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type pg from 'pg'
import type { NotificationItem } from './notification-service.js'

export type EmailConfig = { enabled: boolean; host: string; port: number; secure: boolean; user: string; password: string; from: string }

export class EmailNotificationService {
  private readonly transporter: Transporter | null

  constructor(private readonly pool: pg.Pool, private readonly config: EmailConfig) {
    this.transporter = config.enabled ? nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.password } }) : null
  }

  async sendToUser(userId: string, notification: NotificationItem) {
    if (!this.transporter) return
    const result = await this.pool.query<{ email: string }>(`SELECT email FROM flowline.user_profiles WHERE auth_user_id=$1 AND status='ACTIVE'`, [userId])
    const email = result.rows[0]?.email
    if (!email) return
    await this.transporter.sendMail({ from: this.config.from, to: email, subject: notification.title, text: `${notification.message}\n\nOrder: ${notification.orderNumber ?? 'N/A'}` })
  }
}
