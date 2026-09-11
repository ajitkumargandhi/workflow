import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { WorkflowStep } from '../entities/workflow-step.entity';
import { User } from '../entities/user.entity';
import { ServerConfig } from '../entities/server-config.entity';
import { Client } from 'ldapts';
import * as bcrypt from 'bcrypt';
import { resolveRoleFromAdGroupsAndTitle, getLdapString, getLdapStringArray, extractDomainFromDn } from '../utils/ad-role-mapper';

@Injectable()
export class AdminConfigService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(WorkflowStep)
    private workflowStepRepository: Repository<WorkflowStep>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ServerConfig)
    private serverConfigRepository: Repository<ServerConfig>,
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
    let config = await this.serverConfigRepository.findOne({ where: { id: 1 } });
    if (!config) {
      config = this.serverConfigRepository.create({ id: 1 });
      await this.serverConfigRepository.save(config);
    }
    return {
      systemName: config.system_name,
      sessionTimeout: config.session_timeout,
      maintenanceMode: config.maintenance_mode,
      ldapEnabled: config.ldap_enabled,
      ldapUrl: config.ldap_url,
      ldapBaseDn: config.ldap_base_dn,
      ldapBindDn: config.ldap_bind_dn,
      ldapBindPassword: config.ldap_bind_password ? '••••••••' : '',
      smtpHost: config.smtp_host,
      smtpPort: config.smtp_port,
      smtpUser: config.smtp_user,
      smtpPassword: config.smtp_password ? '••••••••' : '',
      smtpProtocol: config.smtp_protocol,
    };
  }

  async updateServerConfig(data: any) {
    let config = await this.serverConfigRepository.findOne({ where: { id: 1 } });
    if (!config) {
      config = this.serverConfigRepository.create({ id: 1 });
    }

    if (data.systemName !== undefined) config.system_name = data.systemName;
    if (data.sessionTimeout !== undefined) config.session_timeout = Number(data.sessionTimeout);
    if (data.maintenanceMode !== undefined) config.maintenance_mode = Boolean(data.maintenanceMode);
    if (data.ldapEnabled !== undefined) config.ldap_enabled = Boolean(data.ldapEnabled);
    if (data.ldapUrl !== undefined) config.ldap_url = data.ldapUrl;
    if (data.ldapBaseDn !== undefined) config.ldap_base_dn = data.ldapBaseDn;
    if (data.ldapBindDn !== undefined) config.ldap_bind_dn = data.ldapBindDn;
    if (data.ldapBindPassword !== undefined && data.ldapBindPassword !== '' && data.ldapBindPassword !== '••••••••') {
      config.ldap_bind_password = data.ldapBindPassword;
    }
    if (data.smtpHost !== undefined) config.smtp_host = data.smtpHost;
    if (data.smtpPort !== undefined) config.smtp_port = Number(data.smtpPort);
    if (data.smtpUser !== undefined) config.smtp_user = data.smtpUser;
    if (data.smtpPassword !== undefined && data.smtpPassword !== '' && data.smtpPassword !== '••••••••') {
      config.smtp_password = data.smtpPassword;
    }
    if (data.smtpProtocol !== undefined) config.smtp_protocol = data.smtpProtocol;

    await this.serverConfigRepository.save(config);
    return this.getServerConfig();
  }

  // Active Directory / LDAP Connection Test
  async testLdapConnection(): Promise<{ success: boolean; message: string }> {
    const config = await this.serverConfigRepository.findOne({ where: { id: 1 } });
    if (!config || !config.ldap_enabled) {
      return { success: false, message: 'Active Directory / LDAP is currently disabled in server configuration.' };
    }

    if (!config.ldap_url) {
      return { success: false, message: 'Server LDAP URL is missing. Please configure a valid ldap:// or ldaps:// URL.' };
    }

    const client = new Client({
      url: config.ldap_url,
      timeout: 10000,
      connectTimeout: 10000,
      strictDN: false,
      tlsOptions: { rejectUnauthorized: false },
    });

    try {
      await client.bind(config.ldap_bind_dn, config.ldap_bind_password);

      let baseDnNote = '';
      if (config.ldap_base_dn) {
        try {
          const { searchEntries } = await client.search(config.ldap_base_dn, {
            scope: 'sub',
            filter: '(|(&(objectCategory=person)(objectClass=user))(&(objectClass=user)(!(objectClass=computer)))(objectClass=inetOrgPerson)(objectClass=*))',
            sizeLimit: 1,
            timeLimit: 5,
          });
          baseDnNote = ` Base DN "${config.ldap_base_dn}" validated successfully (${searchEntries.length} root entry found).`;
        } catch (searchErr) {
          baseDnNote = ` Warning: Bind succeeded, but Base DN query returned: ${searchErr.message}.`;
        }
      }

      await client.unbind();
      return {
        success: true,
        message: `Successfully connected to LDAP server at ${config.ldap_url} and verified Bind DN (${config.ldap_bind_dn}).${baseDnNote}`,
      };
    } catch (err) {
      try { await client.unbind(); } catch (_) {}
      const errMsg = err.message || '';
      let hint = '';
      if (errMsg.includes('getaddrinfo') || errMsg.includes('ENOTFOUND') || errMsg.includes('EAI_AGAIN')) {
        hint = ' [DNS Resolution Failed]: The container cannot resolve the Active Directory hostname. You can either: 1) Use the direct IP address in the Server LDAP URL (e.g. ldap://192.168.1.10:389), or 2) Configure AD_HOST_ENTRY=hostname.domain.local:IP in your .env file.';
      } else if (errMsg.includes('InvalidCredentialsError') || errMsg.includes('invalid credentials')) {
        hint = ' [Invalid Credentials]: Please verify that your Bind DN user and Bind password are correct.';
      }
      return {
        success: false,
        message: `LDAP Connection failed: ${errMsg}.${hint}`,
      };
    }
  }

  // Sync Users from Active Directory / LDAP
  async syncLdapUsers(): Promise<{ success: boolean; message: string; totalSynced?: number; newlyCreated?: number }> {
    const config = await this.serverConfigRepository.findOne({ where: { id: 1 } });
    if (!config || !config.ldap_enabled) {
      throw new BadRequestException('Active Directory / LDAP is disabled in server configuration.');
    }

    if (!config.ldap_url) {
      throw new BadRequestException('Active Directory / LDAP URL is not configured.');
    }

    const client = new Client({
      url: config.ldap_url,
      timeout: 30000,
      connectTimeout: 15000,
      strictDN: false,
      tlsOptions: { rejectUnauthorized: false },
    });

    let ldapUsers: Array<{
      full_name: string;
      email: string;
      department: string;
      external_id?: string;
      role_id: number;
      is_active: boolean;
    }> = [];

    try {
      await client.bind(config.ldap_bind_dn, config.ldap_bind_password);

      const baseDn = config.ldap_base_dn || 'DC=company,DC=local';
      const domainName = extractDomainFromDn(baseDn);

      // Search filter for human directory users:
      // 1. (&(objectCategory=person)(objectClass=user)) -> Standard Active Directory user accounts (cleanly excludes computers)
      // 2. (&(objectClass=user)(!(objectClass=computer))) -> OpenLDAP / Samba4 / FreeIPA user accounts
      // 3. (objectClass=inetOrgPerson) -> Standard LDAP inetOrgPerson accounts
      const searchFilter = '(|(&(objectCategory=person)(objectClass=user))(&(objectClass=user)(!(objectClass=computer)))(objectClass=inetOrgPerson))';

      const { searchEntries } = await client.search(baseDn, {
        scope: 'sub',
        filter: searchFilter,
        attributes: [
          'dn',
          'sAMAccountName',
          'mail',
          'userPrincipalName',
          'displayName',
          'cn',
          'givenName',
          'sn',
          'department',
          'uid',
          'memberOf',
          'title',
          'userAccountControl',
        ],
        paged: { pageSize: 250 },
        timeLimit: 60,
      });

      console.log(`[LDAP Sync] Search returned ${searchEntries.length} entries for Base DN "${baseDn}". Processing user attributes...`);

      for (const entry of searchEntries) {
        const rawMail = getLdapString(entry.mail);
        const rawUpn = getLdapString(entry.userPrincipalName);
        const rawSam = getLdapString(entry.sAMAccountName);
        const rawUid = getLdapString(entry.uid);

        // Skip computer / machine accounts if any passed through (machine sAMAccountNames end with $)
        if (rawSam.endsWith('$')) {
          continue;
        }

        // Derive primary email address
        let email = '';
        if (rawMail && rawMail.includes('@')) {
          email = rawMail;
        } else if (rawUpn && rawUpn.includes('@')) {
          email = rawUpn;
        } else if (rawSam) {
          email = `${rawSam}@${domainName}`;
        } else if (rawUid) {
          email = `${rawUid}@${domainName}`;
        }

        // Derive display full name
        const rawDisplayName = getLdapString(entry.displayName);
        const rawGivenName = getLdapString(entry.givenName);
        const rawSn = getLdapString(entry.sn);
        const rawCn = getLdapString(entry.cn);
        const combinedName = rawGivenName && rawSn ? `${rawGivenName} ${rawSn}` : '';
        const fullName = rawDisplayName || combinedName || rawCn || rawSam || rawUid || 'AD User';

        // Department
        const department = getLdapString(entry.department) || 'General';

        // External ID (sAMAccountName or uid)
        const externalId = rawSam || rawUid || undefined;

        // Active / Disabled status check from Active Directory userAccountControl
        // In AD: bit 2 (0x0002) = ACCOUNTDISABLE
        const uacStr = getLdapString(entry.userAccountControl);
        const uac = uacStr ? parseInt(uacStr, 10) : 0;
        const isDisabled = !isNaN(uac) && (uac & 2) === 2;

        // Dynamic Role Resolution based on AD group memberships and title
        const memberOfList = getLdapStringArray(entry.memberOf);
        const title = getLdapString(entry.title);
        const resolvedRoleId = resolveRoleFromAdGroupsAndTitle(memberOfList, title, department);

        if (email && email.includes('@')) {
          ldapUsers.push({
            full_name: fullName.trim(),
            email: email.toLowerCase().trim(),
            department: department.trim(),
            external_id: externalId,
            role_id: resolvedRoleId,
            is_active: !isDisabled,
          });
        }
      }

      await client.unbind();
    } catch (ldapErr) {
      try { await client.unbind(); } catch (_) {}
      const errMsg = ldapErr.message || '';
      let hint = '';
      if (errMsg.includes('getaddrinfo') || errMsg.includes('ENOTFOUND') || errMsg.includes('EAI_AGAIN')) {
        hint = ' [DNS Resolution Failed]: The container cannot resolve the Active Directory hostname. You can either: 1) Use the direct IP address in the Server LDAP URL (e.g. ldap://192.168.1.10:389), or 2) Configure AD_HOST_ENTRY=hostname.domain.local:IP in your .env file.';
      }
      console.warn(`[LDAP Sync Error] Search failed (${errMsg}).`);
      return {
        success: false,
        message: `Could not sync from LDAP server (${config.ldap_url}): ${errMsg}.${hint} Ensure LDAP server is reachable and Bind DN credentials are correct.`,
        totalSynced: 0,
        newlyCreated: 0,
      };
    }

    const defaultPasswordHash = await bcrypt.hash('User@123', 10);
    let createdCount = 0;
    let elevatedCount = 0;
    let updatedCount = 0;

    for (const adUser of ldapUsers) {
      const existing = await this.userRepository.findOne({ where: { email: adUser.email }, relations: { role: true } });
      if (!existing) {
        const newUser = this.userRepository.create({
          full_name: adUser.full_name,
          email: adUser.email,
          password: defaultPasswordHash,
          department: adUser.department,
          role: { id: adUser.role_id }, // Automatically set role based on AD group privileges
          auth_source: 'AD',
          external_id: adUser.external_id,
          is_active: adUser.is_active,
        });
        await this.userRepository.save(newUser);
        createdCount++;
        if (adUser.role_id > 1) elevatedCount++;
      } else {
        let changed = false;
        if (existing.auth_source !== 'AD') {
          existing.auth_source = 'AD';
          changed = true;
        }
        if (adUser.external_id && existing.external_id !== adUser.external_id) {
          existing.external_id = adUser.external_id;
          changed = true;
        }
        if (adUser.department && existing.department !== adUser.department) {
          existing.department = adUser.department;
          changed = true;
        }
        if (existing.is_active !== adUser.is_active) {
          existing.is_active = adUser.is_active;
          changed = true;
        }
        // If user's AD group membership has elevated their privileges
        if (adUser.role_id > 1 && (!existing.role || existing.role.id !== adUser.role_id)) {
          existing.role = { id: adUser.role_id } as any;
          changed = true;
          elevatedCount++;
        }
        if (changed) {
          await this.userRepository.save(existing);
          updatedCount++;
        }
      }
    }

    return {
      success: true,
      message: `Active Directory synchronization completed successfully. ${createdCount} new users created, ${updatedCount} existing users updated, ${elevatedCount} elevated roles synchronized, ${ldapUsers.length} total directory users discovered from ${config.ldap_url}.`,
      totalSynced: ldapUsers.length,
      newlyCreated: createdCount,
    };
  }

  // Super Admin Database Export / Backup
  async exportDatabaseBackup() {
    const dataSource = this.categoryRepository.manager.connection;
    const currentConfig = await this.getServerConfig();

    const roles = await dataSource.getRepository('Role').find();
    const users = await dataSource.getRepository('User')
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.manager', 'manager')
      .getMany();
    const categories = await dataSource.getRepository('Category').find({ relations: { parent: true } });
    const workflowSteps = await dataSource.getRepository('WorkflowStep').find({ relations: { category: true, approver_role: true } });
    const requests = await dataSource.getRepository('Request').find({ relations: { category: true, requestor: true, designated_manager: true, assigned_agent: true, closed_by: true } });
    const requestFields = await dataSource.getRepository('RequestField').find({ relations: { request: true } });
    const requestAttachments = await dataSource.getRepository('RequestAttachment').find({ relations: { request: true } });
    const requestUpdates = await dataSource.getRepository('RequestUpdate').find({ relations: { request: true, agent: true } });
    const approvalLogs = await dataSource.getRepository('ApprovalLog').find({ relations: { request: true, approver: true } });

    return {
      version: '1.0.0',
      systemName: currentConfig.systemName,
      timestamp: new Date().toISOString(),
      serverConfig: currentConfig,
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
        await this.updateServerConfig(backupData.serverConfig);
      }

      await queryRunner.query('TRUNCATE TABLE approval_logs, request_updates, request_attachments, request_fields, requests, workflow_steps, categories, users CASCADE;');

      const data = backupData.data;

      // 1. Users Pass 1 (without manager_id to avoid FK dependency order issue)
      if (data.users && data.users.length > 0) {
        const fallbackPasswordHash = await bcrypt.hash('admin123', 10);
        for (const u of data.users) {
          const passwordToInsert = (u.password && typeof u.password === 'string' && u.password.trim().length > 0)
            ? u.password
            : fallbackPasswordHash;
          await queryRunner.query(
            `INSERT INTO users (id, full_name, email, password, department, role_id, manager_id, external_id, auth_source, is_active, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password;`,
            [u.id, u.full_name, u.email, passwordToInsert, u.department, u.role?.id || u.role_id || 1, u.external_id || null, u.auth_source || 'Local', u.is_active !== false, u.created_at || new Date(), u.updated_at || new Date()]
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
