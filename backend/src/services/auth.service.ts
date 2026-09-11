import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { ServerConfig } from '../entities/server-config.entity';
import { NotificationService } from './notification.service';
import { Client } from 'ldapts';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { resolveRoleFromAdGroupsAndTitle, escapeLdapFilter, getLdapString, extractDomainFromDn } from '../utils/ad-role-mapper';

@Injectable()
export class AuthService {
  private resetTokens: Map<string, { userId: string; expires: number }> = new Map();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ServerConfig)
    private serverConfigRepository: Repository<ServerConfig>,
    private jwtService: JwtService,
    private notificationService: NotificationService,
  ) {}

  async login(email: string, pass: string) {
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    let user = await this.userRepository.createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.manager', 'manager')
      .where('LOWER(user.email) = :email', { email: cleanEmail })
      .getOne();

    let authenticated = false;

    // 1. If user does not exist locally, check if Active Directory auto-provisioning is possible
    if (!user) {
      const serverConfig = await this.serverConfigRepository.findOne({ where: { id: 1 } });
      if (serverConfig && serverConfig.ldap_enabled && serverConfig.ldap_url) {
        try {
          const client = new Client({
            url: serverConfig.ldap_url,
            timeout: 8000,
            connectTimeout: 8000,
            strictDN: false,
            tlsOptions: { rejectUnauthorized: false },
          });

          let userEntry: any = null;
          if (serverConfig.ldap_bind_dn && serverConfig.ldap_bind_password && serverConfig.ldap_base_dn) {
            await client.bind(serverConfig.ldap_bind_dn, serverConfig.ldap_bind_password);
            const rawUsername = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
            const safeEmail = escapeLdapFilter(cleanEmail);
            const safeUsername = escapeLdapFilter(rawUsername);
            const searchFilter = `(|(mail=${safeEmail})(userPrincipalName=${safeEmail})(sAMAccountName=${safeUsername})(uid=${safeUsername}))`;
            const { searchEntries } = await client.search(serverConfig.ldap_base_dn, {
              scope: 'sub',
              filter: searchFilter,
              attributes: ['dn', 'mail', 'userPrincipalName', 'displayName', 'cn', 'givenName', 'sn', 'department', 'sAMAccountName', 'uid', 'memberOf', 'title', 'userAccountControl'],
              sizeLimit: 1,
              timeLimit: 10,
            });
            await client.unbind();
            if (searchEntries && searchEntries.length > 0) {
              userEntry = searchEntries[0];
            }
          }

          const userDn = userEntry ? getLdapString(userEntry.dn) : '';
          const bindTarget = userDn || cleanEmail;
          const authClient = new Client({
            url: serverConfig.ldap_url,
            timeout: 8000,
            connectTimeout: 8000,
            strictDN: false,
            tlsOptions: { rejectUnauthorized: false },
          });

          await authClient.bind(bindTarget, pass);
          await authClient.unbind();

          // Successful authentication against Active Directory! Auto-provision account
          const domainName = extractDomainFromDn(serverConfig.ldap_base_dn);
          const rawMail = getLdapString(userEntry?.mail);
          const rawUpn = getLdapString(userEntry?.userPrincipalName);
          const rawSam = getLdapString(userEntry?.sAMAccountName);
          const rawUid = getLdapString(userEntry?.uid);
          const username = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;

          let adEmail = '';
          if (rawMail && rawMail.includes('@')) {
            adEmail = rawMail;
          } else if (rawUpn && rawUpn.includes('@')) {
            adEmail = rawUpn;
          } else if (cleanEmail.includes('@')) {
            adEmail = cleanEmail;
          } else if (rawSam) {
            adEmail = `${rawSam}@${domainName}`;
          } else {
            adEmail = `${username}@${domainName}`;
          }

          const rawDisplayName = getLdapString(userEntry?.displayName);
          const rawGivenName = getLdapString(userEntry?.givenName);
          const rawSn = getLdapString(userEntry?.sn);
          const rawCn = getLdapString(userEntry?.cn);
          const combinedName = rawGivenName && rawSn ? `${rawGivenName} ${rawSn}` : '';
          const fullName = rawDisplayName || combinedName || rawCn || username || 'AD User';

          const department = getLdapString(userEntry?.department) || 'General';
          const externalId = rawSam || rawUid || undefined;
          const defaultPasswordHash = await bcrypt.hash('User@123', 10);
          const resolvedRoleId = resolveRoleFromAdGroupsAndTitle(userEntry?.memberOf, userEntry?.title, department);

          const newUser = this.userRepository.create({
            full_name: fullName.trim(),
            email: adEmail.toLowerCase().trim(),
            password: defaultPasswordHash,
            department: department.trim(),
            role: { id: resolvedRoleId },
            auth_source: 'AD',
            external_id: externalId,
            is_active: true,
          });
          user = await this.userRepository.save(newUser);
          user = await this.userRepository.findOne({ where: { id: user.id }, relations: { role: true, manager: true } });
          authenticated = true;
          console.log(`[LDAP Auto-Provision] User ${user?.email} auto-provisioned with role ${user?.role?.role_name} via Active Directory.`);
        } catch (adErr) {
          console.warn(`[LDAP Auto-Provision/Auth Failed] ${adErr.message}`);
        }
      }
    }

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.is_active === false) {
      throw new UnauthorizedException('User account is disabled');
    }

    // 2. If user exists with auth_source === 'AD', authenticate against Active Directory / LDAP
    if (!authenticated && user.auth_source === 'AD') {
      const serverConfig = await this.serverConfigRepository.findOne({ where: { id: 1 } });
      if (serverConfig && serverConfig.ldap_enabled && serverConfig.ldap_url) {
        try {
          const client = new Client({
            url: serverConfig.ldap_url,
            timeout: 8000,
            connectTimeout: 8000,
            strictDN: false,
            tlsOptions: { rejectUnauthorized: false },
          });

          let userDn = user.email;
          let userEntry: any = null;

          // Attempt DN search using service account for 100% reliable LDAP/AD binding
          if (serverConfig.ldap_bind_dn && serverConfig.ldap_bind_password && serverConfig.ldap_base_dn) {
            try {
              await client.bind(serverConfig.ldap_bind_dn, serverConfig.ldap_bind_password);
              const safeEmail = escapeLdapFilter(user.email);
              const safeExtId = user.external_id ? escapeLdapFilter(user.external_id) : '';
              const safePrefix = escapeLdapFilter(cleanEmail.split('@')[0]);
              const searchFilter = user.external_id
                ? `(|(mail=${safeEmail})(userPrincipalName=${safeEmail})(sAMAccountName=${safeExtId})(uid=${safeExtId}))`
                : `(|(mail=${safeEmail})(userPrincipalName=${safeEmail})(sAMAccountName=${safePrefix}))`;

              const { searchEntries } = await client.search(serverConfig.ldap_base_dn, {
                scope: 'sub',
                filter: searchFilter,
                attributes: ['dn', 'mail', 'sAMAccountName', 'memberOf', 'title', 'department'],
                sizeLimit: 1,
                timeLimit: 10,
              });

              if (searchEntries && searchEntries.length > 0) {
                userEntry = searchEntries[0];
                const resolvedDn = getLdapString(userEntry.dn);
                if (resolvedDn) userDn = resolvedDn;
              }
              await client.unbind();
            } catch (searchErr) {
              console.warn(`[LDAP User Lookup] Falling back to direct email bind: ${searchErr.message}`);
              try { await client.unbind(); } catch (_) {}
            }
          }

          // Authenticate user with resolved DN (or email) and password
          const authClient = new Client({
            url: serverConfig.ldap_url,
            timeout: 8000,
            connectTimeout: 8000,
            strictDN: false,
            tlsOptions: { rejectUnauthorized: false },
          });

          await authClient.bind(userDn, pass);
          await authClient.unbind();
          authenticated = true;
          console.log(`[LDAP Auth] User ${user.email} authenticated successfully via Active Directory.`);

          // If AD user has elevated groups/title in Active Directory, dynamically elevate role
          if (userEntry) {
            const currentDept = getLdapString(userEntry.department) || user.department || 'General';
            const resolvedRoleId = resolveRoleFromAdGroupsAndTitle(userEntry.memberOf, userEntry.title, currentDept);
            if (resolvedRoleId > 1 && (!user.role || user.role.id !== resolvedRoleId)) {
              user.role = { id: resolvedRoleId } as any;
              await this.userRepository.save(user);
              user = await this.userRepository.findOne({ where: { id: user.id }, relations: { role: true, manager: true } });
              console.log(`[LDAP Role Elevation] User ${user?.email} dynamically elevated to ${user?.role?.role_name} via Active Directory.`);
            }
          }
        } catch (ldapErr) {
          console.warn(`[LDAP Auth Failed] AD bind failed for ${user.email}: ${ldapErr.message}`);
        }
      }
    }

    // 3. Fallback or Local password check with bcrypt
    if (!authenticated) {
      if (user.password) {
        authenticated = await bcrypt.compare(pass, user.password);
      }
    }

    if (!authenticated) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: user.id, email: user.email, role: user.role?.role_name };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        department: user.department,
        role: user.role?.role_name,
        manager: user.manager ? { id: user.manager.id, full_name: user.manager.full_name, email: user.manager.email } : null,
      },
    };
  }

  async forgotPassword(email: string, clientUrl?: string) {
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const user = await this.userRepository.findOne({ where: { email: cleanEmail } });
    if (!user) {
      return { message: 'If that account exists, password reset instructions have been dispatched via email.' };
    }

    // Clean up expired reset tokens to prevent memory accumulation
    const now = Date.now();
    for (const [key, val] of this.resetTokens.entries()) {
      if (now > val.expires) {
        this.resetTokens.delete(key);
      }
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expires = now + 3600000; // 1 hour
    this.resetTokens.set(token, { userId: user.id, expires });

    // Determine clean base URL for password reset link
    let baseUrl = 'http://localhost';
    if (clientUrl && typeof clientUrl === 'string') {
      baseUrl = clientUrl.replace(/\/+$/, '').split('?')[0];
    }
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send reset instructions via SMTP Notification Service with both link and token
    await this.notificationService.notifyPasswordReset(user.email, user.full_name, token, resetUrl);

    return {
      message: 'If that account exists, password reset instructions have been dispatched via email.',
    };
  }

  async resetPasswordWithToken(token: string, newPass: string) {
    const record = this.resetTokens.get(token);
    if (!record || Date.now() > record.expires) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const hashedPassword = await bcrypt.hash(newPass, 10);
    await this.userRepository.update(record.userId, { password: hashedPassword });
    this.resetTokens.delete(token);

    return { message: 'Password has been reset successfully. You may now log in.' };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
