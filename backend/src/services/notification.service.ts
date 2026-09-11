import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServerConfig } from '../entities/server-config.entity';
import { User } from '../entities/user.entity';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(ServerConfig)
    private serverConfigRepository: Repository<ServerConfig>,
  ) { }

  private async getTransporter(): Promise<{ transporter: nodemailer.Transporter; sender: string; config: ServerConfig | null }> {
    const config = await this.serverConfigRepository.findOne({ where: { id: 1 } });
    const host = config?.smtp_host || 'smtp.company.com';
    const port = config?.smtp_port || 587;
    const protocol = config?.smtp_protocol || 'STARTTLS';
    const isSecure = port === 465 || protocol === 'SSL/TLS';

    let sender = 'notifications@company.com';
    if (config?.smtp_user) {
      if (config.smtp_user.includes('@')) {
        sender = config.smtp_user;
      } else if (config?.smtp_host && !config.smtp_host.includes('company.com')) {
        sender = `${config.smtp_user}@${config.smtp_host.replace(/^smtp\./i, '')}`;
      } else {
        sender = `${config.smtp_user}@company.com`;
      }
    }

    const transportOptions: any = {
      host,
      port,
      secure: isSecure,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false,
      },
    };

    if (protocol === 'None') {
      transportOptions.ignoreTLS = true;
    }

    if (config?.smtp_user && config?.smtp_password) {
      transportOptions.auth = {
        user: config.smtp_user,
        pass: config.smtp_password,
      };
    }

    const transporter = nodemailer.createTransport(transportOptions);
    return { transporter, sender, config };
  }

  async testSmtpConnection(targetEmail?: string): Promise<{ success: boolean; message: string }> {
    try {
      const { transporter, sender, config } = await this.getTransporter();
      if (!config || !config.smtp_host) {
        return { success: false, message: 'SMTP configuration is missing. Please provide an SMTP server host.' };
      }

      // Step 1: Verify SMTP socket handshake and credentials
      await transporter.verify();

      // Step 2: Send test email to target
      const recipient = targetEmail || sender;
      const info = await transporter.sendMail({
        from: `"Enterprise Workflow" <${sender}>`,
        to: recipient,
        subject: `[Test Email] Workflow Notification Service Verification`,
        text: `This is a verification email from your Enterprise Workflow Engine. SMTP connection to ${config.smtp_host}:${config.smtp_port} was established successfully.`,
        html: `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-top: 0;">Enterprise Workflow Engine</h2>
          <p>This is a verification email sent from your workflow notification configuration.</p>
          <div style="background-color: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 14px; margin: 15px 0;">
            <strong>SMTP Host:</strong> ${config.smtp_host}<br/>
            <strong>SMTP Port:</strong> ${config.smtp_port}<br/>
            <strong>Protocol:</strong> ${config.smtp_protocol}<br/>
            <strong>Sender Email:</strong> ${sender}
          </div>
          <p style="color: #16a34a; font-weight: bold;">✓ SMTP socket handshake, authentication, and transport verified successfully.</p>
        </div>`,
      });

      return {
        success: true,
        message: `SMTP connection verified and test email dispatched successfully to ${recipient} (Message ID: ${info.messageId || 'OK'}).`,
      };
    } catch (err) {
      return {
        success: false,
        message: `SMTP Connection / Dispatch failed: ${err.message || 'Unknown SMTP error'}. Please verify host, port, credentials, and TLS settings.`,
      };
    }
  }

  private escapeHtml(unsafe: string): string {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async sendEmail(to: string, subject: string, templateName: string, context: any): Promise<void> {
    try {
      const possiblePaths = [
        path.join(process.cwd(), 'src', 'templates', `${templateName}.html`),
        path.join(__dirname, '..', 'templates', `${templateName}.html`),
        path.join(__dirname, '..', '..', 'src', 'templates', `${templateName}.html`),
        path.join('/app', 'src', 'templates', `${templateName}.html`),
        path.join('/app', 'dist', 'templates', `${templateName}.html`),
      ];

      let html = '';
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          html = fs.readFileSync(p, 'utf8');
          break;
        }
      }

      if (html) {
        for (const key in context) {
          const rawVal = context[key] !== undefined && context[key] !== null ? String(context[key]) : '';
          let safeVal: string;
          if (key.toLowerCase().includes('url')) {
            safeVal = rawVal.replace(/[^\w\-._~:/?#[\]@!$&'()*+,;=]/gi, '');
          } else {
            safeVal = this.escapeHtml(rawVal);
          }
          // Pass replacer function () => safeVal to prevent $ replacement pattern corruption
          html = html.replace(new RegExp(`{{${key}}}`, 'g'), () => safeVal);
        }
      } else {
        html = `<h3>${this.escapeHtml(subject)}</h3><pre>${this.escapeHtml(JSON.stringify(context, null, 2))}</pre>`;
      }

      const { transporter, sender } = await this.getTransporter();
      await transporter.sendMail({
        from: `"Enterprise Workflow" <${sender}>`,
        to,
        subject,
        html,
      });
      console.log(`[Email Dispatched via SMTP] To: ${to} | Subject: ${subject}`);
    } catch (err) {
      console.warn(`[SMTP Notification Error] Failed sending email to ${to}: ${err.message}`);
    }
  }

  async notifyRequestorOfSubmission(user: User, request: any): Promise<void> {
    if (!user || !user.email) return;
    await this.sendEmail(
      user.email,
      'Request Submitted Successfully',
      'email-submission',
      {
        name: user.full_name,
        trackingId: request.tracking_id,
        category: request.category?.name || request.primary_category || 'General',
        date: new Date().toLocaleDateString(),
      }
    );
  }

  async notifyApproverOfPendingAction(approver: User, request: any, step?: any): Promise<void> {
    if (!approver || !approver.email) return;
    await this.sendEmail(
      approver.email,
      'Action Required: Request Approval',
      'email-approval',
      {
        name: approver.full_name,
        requestor: request.requestor?.full_name || 'Employee',
        trackingId: request.tracking_id,
        category: request.category?.name || request.primary_category || 'General',
        justification: request.justification || 'No justification provided',
        actionLink: `http://localhost:3000/approvals`,
      }
    );
  }

  async notifyRequestorOfStatusChange(user: User, request: any, status: string, comments: string): Promise<void> {
    if (!user || !user.email) return;
    await this.sendEmail(
      user.email,
      `Request Status Update: ${status}`,
      'email-status',
      {
        name: user.full_name,
        trackingId: request.tracking_id,
        status: status,
        comments: comments || 'No comments provided',
      }
    );
  }

  async notifyPasswordReset(email: string, fullName: string, token: string, resetUrl: string): Promise<void> {
    await this.sendEmail(
      email,
      'Password Reset Instructions - Enterprise Workflow',
      'email-password-reset',
      {
        name: fullName || 'User',
        token,
        resetUrl: resetUrl || `http://localhost/reset-password?token=${token}`,
      }
    );
  }
}
