import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('app.resend.apiKey') || '';
    this.resend = new Resend(apiKey);
    const name = config.get<string>('app.resend.fromName') ?? 'Loraloop';
    const email = config.get<string>('app.resend.fromEmail') ?? 'noreply@loraloop.ai';
    this.from = `${name} <${email}>`;
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    await this.send(to, 'Welcome to Loraloop 🚀', this.welcomeHtml(name));
  }

  async sendNotificationDigest(
    to: string,
    notifications: { title: string; message: string }[],
  ): Promise<void> {
    await this.send(to, 'Your Loraloop activity digest', this.digestHtml(notifications));
  }

  async sendContentPublished(
    to: string,
    opts: { platform: string; postUrl: string },
  ): Promise<void> {
    await this.send(
      to,
      `Your post on ${opts.platform} is live!`,
      this.publishedHtml(opts),
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.config.get<string>('app.resend.apiKey')) {
      this.logger.warn(`Email skipped (no RESEND_API_KEY): ${subject} → ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${(err as Error).message}`);
    }
  }

  // ── Templates ────────────────────────────────────────────────────────────

  private welcomeHtml(name: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 0; }
  .card { background: #fff; max-width: 560px; margin: 0 auto; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  h1 { color: #111827; font-size: 24px; margin: 0 0 8px; }
  p { color: #6b7280; line-height: 1.6; margin: 12px 0; }
  .btn { display: inline-block; background: #4f5eff; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 20px; }
  .features { margin: 24px 0; padding: 20px; background: #f3f4f6; border-radius: 8px; }
  .feature { margin: 8px 0; color: #374151; }
</style></head>
<body>
  <div class="card">
    <h1>Welcome, ${name}! ✨</h1>
    <p>You're in. Loraloop is your AI-powered social media command centre — let's get you set up.</p>
    <div class="features">
      <div class="feature">✅ Connect your social platforms</div>
      <div class="feature">🎨 Set your brand voice with Clara</div>
      <div class="feature">📅 Schedule content at optimal times</div>
      <div class="feature">📊 Track performance with real-time analytics</div>
    </div>
    <p>Head to your dashboard to connect your first platform and start creating.</p>
    <a href="${this.config.get('app.frontendUrl')}/dashboard" class="btn">Go to Dashboard →</a>
    <p style="margin-top: 32px; font-size: 13px; color: #9ca3af;">You received this because you signed up for Loraloop. Questions? Reply to this email.</p>
  </div>
</body>
</html>`;
  }

  private digestHtml(items: { title: string; message: string }[]): string {
    const rows = items
      .map(
        (n) => `<tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
          <strong style="color:#111827">${n.title}</strong>
          <p style="margin:4px 0 0;color:#6b7280;font-size:14px">${n.message}</p>
        </td></tr>`,
      )
      .join('');
    return `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system,sans-serif; background:#f9fafb; margin:0; padding:40px 0; }
  .card { background:#fff; max-width:560px; margin:0 auto; border-radius:12px; padding:40px; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
  h1 { color:#111827; font-size:22px; margin:0 0 20px; }
  table { width:100%; border-collapse:collapse; }
  .btn { display:inline-block; background:#4f5eff; color:#fff; text-decoration:none; padding:10px 20px; border-radius:8px; font-weight:600; margin-top:20px; }
</style></head>
<body><div class="card">
  <h1>Your activity digest 🔔</h1>
  <table>${rows}</table>
  <a href="${this.config.get('app.frontendUrl')}/notifications" class="btn">View all →</a>
</div></body></html>`;
  }

  private publishedHtml(opts: { platform: string; postUrl: string }): string {
    return `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body { font-family:-apple-system,sans-serif; background:#f9fafb; margin:0; padding:40px 0; }
  .card { background:#fff; max-width:560px; margin:0 auto; border-radius:12px; padding:40px; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
  h1 { color:#111827; font-size:22px; }
  .btn { display:inline-block; background:#10b981; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; margin-top:16px; }
</style></head>
<body><div class="card">
  <h1>Your post is live on ${opts.platform}! 🎉</h1>
  <p style="color:#6b7280">It's published and reaching your audience right now.</p>
  <a href="${opts.postUrl}" class="btn">View post →</a>
</div></body></html>`;
  }
}
