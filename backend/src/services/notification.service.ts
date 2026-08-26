import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '../entities/user.entity';

@Injectable()
export class NotificationService {
  async sendEmail(to: string, subject: string, templateName: string, context: any): Promise<void> {
    const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);
    let html = fs.readFileSync(templatePath, 'utf8');

    // Simple template replacement
    for (const key in context) {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), context[key]);
    }

    console.log(`[Email Sent] To: ${to} | Subject: ${subject} | Body: ${html}`);
    // In a real production environment, you would use nodemailer or a similar library
    // to actually send the email via SMTP.
  }

  async notifyRequestorOfSubmission(user: User, request: any): Promise<void> {
    await this.sendEmail(
      user.email,
      'Request Submitted Successfully',
      'email-submission',
      {
        name: user.full_name,
        trackingId: request.tracking_id,
        category: request.category.name,
        date: new Date().toLocaleDateString(),
      }
    );
  }

  async notifyApproverOfPendingAction(approver: User, request: any, step: any): Promise<void> {
    await this.sendEmail(
      approver.email,
      'Action Required: Request Approval',
      'email-approval',
      {
        name: approver.full_name,
        requestor: request.requestor.full_name,
        trackingId: request.tracking_id,
        category: request.category.name,
        justification: request.justification || 'No justification provided',
        actionLink: `http://localhost:3000/approvals/${request.id}`,
      }
    );
  }

  async notifyRequestorOfStatusChange(user: User, request: any, status: string, comments: string): Promise<void> {
    await this.sendEmail(
      user.email,
      'Request Status Update',
      'email-status',
      {
        name: user.full_name,
        trackingId: request.tracking_id,
        status: status,
        comments: comments || 'No comments provided',
      }
    );
  }
}
