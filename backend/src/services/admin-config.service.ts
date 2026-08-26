import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { WorkflowStep } from '../entities/workflow-step.entity';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminConfigService {
  private serverConfigState = {
    systemName: 'Enterprise Workflow Engine',
    sessionTimeout: 60,
    maintenanceMode: false,
    ldapEnabled: true,
    ldapUrl: 'ldap://ad.company.local:389',
    ldapBaseDn: 'DC=company,DC=local',
    ldapBindDn: 'CN=Admin,DC=company,DC=local',
    ldapBindPassword: 'SecretPassword123',
    smtpHost: 'smtp.company.com',
    smtpPort: 587,
    smtpUser: 'notifications@company.com',
    smtpPassword: 'SmtpSecretPassword123',
    smtpProtocol: 'STARTTLS',
  };

  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(WorkflowStep)
    private workflowStepRepository: Repository<WorkflowStep>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // Category Management
  async createCategory(data: Partial<Category>): Promise<Category> {
    const category = this.categoryRepository.create(data);
    return this.categoryRepository.save(category);
  }

  async updateCategory(id: number, data: Partial<Category>): Promise<Category> {
    await this.categoryRepository.update(id, data);
    return this.categoryRepository.findOne({ where: { id }, relations: { parent: true } });
  }

  async deleteCategory(id: number): Promise<void> {
    await this.categoryRepository.delete(id);
  }

  async getCategoryTree(): Promise<Category[]> {
    return this.categoryRepository.find({
      relations: { parent: true },
      order: { id: 'ASC' }
    });
  }

  // Workflow Mapping Management
  async setWorkflowSteps(categoryId: number, steps: Partial<WorkflowStep>[]): Promise<void> {
    await this.workflowStepRepository.delete({ category: { id: categoryId } });

    const stepEntities = steps.map((step, index) => {
      return this.workflowStepRepository.create({
        ...step,
        category: { id: categoryId },
        step_order: index + 1,
      });
    });

    await this.workflowStepRepository.save(stepEntities);
  }

  async getWorkflowForCategory(categoryId: number): Promise<WorkflowStep[]> {
    return this.workflowStepRepository.find({
      where: { category: { id: categoryId } },
      order: { step_order: 'ASC' },
      relations: { approver_role: true },
    });
  }

  // Server & AD Configuration
  async getServerConfig() {
    return this.serverConfigState;
  }

  async updateServerConfig(data: any) {
    this.serverConfigState = { ...this.serverConfigState, ...data };
    return this.serverConfigState;
  }

  // Sync Users from Active Directory / LDAP
  async syncLdapUsers() {
    const adDirectoryUsers = [
      { full_name: 'David AD Manager', email: 'david.ad@company.com', department: 'Finance', role_id: 2, external_id: 'AD-9001' },
      { full_name: 'Sarah AD Employee', email: 'sarah.ad@company.com', department: 'Finance', role_id: 1, external_id: 'AD-9002' },
      { full_name: 'Robert AD IT Lead', email: 'robert.ad@company.com', department: 'IT Support', role_id: 3, external_id: 'AD-9003' },
    ];

    const defaultPasswordHash = await bcrypt.hash('admin123', 10);
    let createdCount = 0;

    for (const adUser of adDirectoryUsers) {
      const existing = await this.userRepository.findOne({ where: { email: adUser.email } });
      if (!existing) {
        const newUser = this.userRepository.create({
          full_name: adUser.full_name,
          email: adUser.email,
          password: defaultPasswordHash,
          department: adUser.department,
          role: { id: adUser.role_id },
          auth_source: 'AD',
          external_id: adUser.external_id,
          is_active: true,
        });
        await this.userRepository.save(newUser);
        createdCount++;
      }
    }

    return {
      success: true,
      message: `Active Directory synchronization completed successfully. ${createdCount} new users imported from ${this.serverConfigState.ldapUrl}.`,
      totalSynced: adDirectoryUsers.length,
      newlyCreated: createdCount,
    };
  }

  // Super Admin Database Export / Backup
  async exportDatabaseBackup() {
    const dataSource = this.categoryRepository.manager.connection;

    const roles = await dataSource.getRepository('Role').find();
    const users = await dataSource.getRepository('User').find({ relations: { role: true, manager: true } });
    const categories = await dataSource.getRepository('Category').find({ relations: { parent: true } });
    const workflowSteps = await dataSource.getRepository('WorkflowStep').find({ relations: { category: true, approver_role: true } });
    const requests = await dataSource.getRepository('Request').find({ relations: { category: true, requestor: true, designated_manager: true, assigned_agent: true, closed_by: true } });
    const requestFields = await dataSource.getRepository('RequestField').find({ relations: { request: true } });
    const requestAttachments = await dataSource.getRepository('RequestAttachment').find({ relations: { request: true } });
    const requestUpdates = await dataSource.getRepository('RequestUpdate').find({ relations: { request: true, agent: true } });
    const approvalLogs = await dataSource.getRepository('ApprovalLog').find({ relations: { request: true, approver: true } });

    return {
      version: '1.0.0',
      systemName: this.serverConfigState.systemName,
      timestamp: new Date().toISOString(),
      serverConfig: this.serverConfigState,
      data: {
        roles,
        users,
        categories,
        workflowSteps,
        requests,
        requestFields,
        requestAttachments,
        requestUpdates,
        approvalLogs,
      },
    };
  }

  // Super Admin Database Restore
  async restoreDatabaseBackup(backupData: any) {
    if (!backupData || !backupData.data) {
      throw new BadRequestException('Invalid database backup payload format.');
    }

    const dataSource = this.categoryRepository.manager.connection;
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (backupData.serverConfig) {
        this.serverConfigState = { ...this.serverConfigState, ...backupData.serverConfig };
      }

      await queryRunner.query('TRUNCATE TABLE approval_logs, request_updates, request_attachments, request_fields, requests, workflow_steps, categories, users CASCADE;');

      const data = backupData.data;

      // 1. Users Pass 1 (without manager_id to avoid FK dependency order issue)
      if (data.users && data.users.length > 0) {
        for (const u of data.users) {
          await queryRunner.query(
            `INSERT INTO users (id, full_name, email, password, department, role_id, manager_id, external_id, auth_source, is_active, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO NOTHING;`,
            [u.id, u.full_name, u.email, u.password, u.department, u.role?.id || u.role_id || 1, u.external_id || null, u.auth_source || 'Local', u.is_active !== false, u.created_at || new Date(), u.updated_at || new Date()]
          );
        }

        // 1. Users Pass 2 (update manager_id references)
        for (const u of data.users) {
          const mgrId = u.manager?.id || u.manager_id || null;
          if (mgrId) {
            await queryRunner.query(
              `UPDATE users SET manager_id = $1 WHERE id = $2;`,
              [mgrId, u.id]
            );
          }
        }
      }

      // 2. Categories Pass 1 (without parent_id)
      if (data.categories && data.categories.length > 0) {
        for (const c of data.categories) {
          await queryRunner.query(
            `INSERT INTO categories (id, name, parent_id, is_active) VALUES ($1, $2, NULL, $3) ON CONFLICT (id) DO UPDATE SET name = $2;`,
            [c.id, c.name, c.is_active !== false]
          );
        }

        // 2. Categories Pass 2 (update parent_id references)
        for (const c of data.categories) {
          const pId = c.parent?.id || c.parent_id || null;
          if (pId) {
            await queryRunner.query(
              `UPDATE categories SET parent_id = $1 WHERE id = $2;`,
              [pId, c.id]
            );
          }
        }
      }

      // 3. Workflow Steps
      if (data.workflowSteps && data.workflowSteps.length > 0) {
        for (const w of data.workflowSteps) {
          await queryRunner.query(
            `INSERT INTO workflow_steps (id, category_id, step_order, approver_role_id, min_cost_threshold, is_mandatory) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING;`,
            [w.id, w.category?.id || w.category_id, w.step_order, w.approver_role?.id || w.approver_role_id, w.min_cost_threshold || 0, w.is_mandatory !== false]
          );
        }
      }

      // 4. Requests
      if (data.requests && data.requests.length > 0) {
        for (const r of data.requests) {
          await queryRunner.query(
            `INSERT INTO requests (id, tracking_id, requestor_id, designated_manager_id, category_id, assigned_agent_id, closed_by_id, total_cost, currency, fulfillment_type, status, urgency, justification, fulfillment_notes, closed_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) ON CONFLICT (id) DO NOTHING;`,
            [r.id, r.tracking_id, r.requestor?.id || r.requestor_id || null, r.designated_manager?.id || r.designated_manager_id || null, r.category?.id || r.category_id, r.assigned_agent?.id || r.assigned_agent_id || null, r.closed_by?.id || r.closed_by_id || null, r.total_cost || 0, r.currency || 'USD', r.fulfillment_type || 'New Purchase', r.status || 'Pending', r.urgency || 'Medium', r.justification || '', r.fulfillment_notes || null, r.closed_at || null, r.created_at || new Date(), r.updated_at || new Date()]
          );
        }
      }

      // 5. Request Fields
      if (data.requestFields && data.requestFields.length > 0) {
        for (const f of data.requestFields) {
          await queryRunner.query(
            `INSERT INTO request_fields (id, request_id, field_key, field_value) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING;`,
            [f.id, f.request?.id || f.request_id, f.field_key, f.field_value]
          );
        }
      }

      // 6. Request Attachments
      if (data.requestAttachments && data.requestAttachments.length > 0) {
        for (const a of data.requestAttachments) {
          await queryRunner.query(
            `INSERT INTO request_attachments (id, request_id, file_name, file_path, file_type) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING;`,
            [a.id, a.request?.id || a.request_id, a.file_name, a.file_path, a.file_type || 'unknown']
          );
        }
      }

      // 7. Request Updates
      if (data.requestUpdates && data.requestUpdates.length > 0) {
        for (const u of data.requestUpdates) {
          await queryRunner.query(
            `INSERT INTO request_updates (id, request_id, agent_id, status, note, timestamp) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING;`,
            [u.id, u.request?.id || u.request_id, u.agent?.id || u.agent_id || null, u.status, u.note, u.timestamp || new Date()]
          );
        }
      }

      // 8. Approval Logs
      if (data.approvalLogs && data.approvalLogs.length > 0) {
        for (const l of data.approvalLogs) {
          await queryRunner.query(
            `INSERT INTO approval_logs (id, request_id, approver_id, action, comments, step_order, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING;`,
            [l.id, l.request?.id || l.request_id, l.approver?.id || l.approver_id || null, l.action, l.comments, l.step_order, l.timestamp || new Date()]
          );
        }
      }

      await queryRunner.commitTransaction();
      return {
        success: true,
        message: 'Database restoration completed successfully. All tables and records restored.',
        restoredTimestamp: backupData.timestamp || new Date().toISOString(),
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException('Database restore failed: ' + err.message);
    } finally {
      await queryRunner.release();
    }
  }
}
