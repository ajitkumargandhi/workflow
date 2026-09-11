/**
 * Helper to safely extract a single string value from LDAP attribute
 * which can be string, string[], Buffer, Buffer[], or undefined.
 */
export function getLdapString(val: any): string {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) {
    if (val.length === 0) return '';
    return getLdapString(val[0]);
  }
  if (Buffer.isBuffer(val)) {
    return val.toString('utf-8').trim();
  }
  return String(val).trim();
}

/**
 * Helper to safely extract an array of strings from LDAP attribute
 * (such as memberOf, objectClass, etc.)
 */
export function getLdapStringArray(val: any): string[] {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) {
    const list: string[] = [];
    for (const item of val) {
      const s = getLdapString(item);
      if (s) list.push(s);
    }
    return list;
  }
  const single = getLdapString(val);
  return single ? [single] : [];
}

/**
 * Derives corporate domain from LDAP Base DN.
 * Example: 'OU=Staff,DC=corp,DC=acme,DC=local' -> 'corp.acme.local'
 * Default fallback: 'company.local'
 */
export function extractDomainFromDn(dn?: string): string {
  if (!dn) return 'company.local';
  const dcMatches = String(dn).match(/DC=([^,]+)/gi);
  if (dcMatches && dcMatches.length > 0) {
    return dcMatches
      .map(part => part.replace(/DC=/i, '').trim())
      .join('.')
      .toLowerCase();
  }
  return 'company.local';
}

/**
 * Maps Active Directory / LDAP groups and titles to Workflow Engine roles:
 * 1 = Requestor (Default Employee)
 * 2 = Approver (Manager / Supervisor)
 * 3 = IT Agent (IT Support / Helpdesk)
 * 4 = Admin Agent (Office Admin / Facilities)
 * 5 = Super Admin (Domain Admin / Full Control)
 */
export function resolveRoleFromAdGroupsAndTitle(
  memberOf: any,
  title?: any,
  department?: any
): number {
  const groups = getLdapStringArray(memberOf).map(g => g.toLowerCase());
  const titleStr = getLdapString(title).toLowerCase();
  const deptStr = getLdapString(department).toLowerCase();

  // 1. Super Admin (Role 5)
  // Check for Domain Admins, Enterprise Admins, Workflow Admins, etc.
  const isSuperAdmin = groups.some(g =>
    g.includes('domain admins') ||
    g.includes('enterprise admins') ||
    g.includes('administrators') ||
    g.includes('workflow-superadmin') ||
    g.includes('workflow-admin') ||
    g.includes('it admins') ||
    g.includes('global admin')
  ) || titleStr.includes('system administrator') || titleStr.includes('it director') || titleStr.includes('chief information officer');

  if (isSuperAdmin) return 5;

  // 2. IT Agent (Role 3)
  // Check for IT Support, Helpdesk, ServiceDesk, IT Staff
  const isItAgent = groups.some(g =>
    g.includes('it support') ||
    g.includes('helpdesk') ||
    g.includes('servicedesk') ||
    g.includes('it agent') ||
    g.includes('it staff') ||
    g.includes('workflow-itsupport') ||
    g.includes('desktop support')
  ) || titleStr.includes('it support') || titleStr.includes('helpdesk') || titleStr.includes('service desk') || (deptStr.includes('it support') && titleStr.includes('specialist'));

  if (isItAgent) return 3;

  // 3. Admin Agent (Role 4)
  // Check for Office Admin, Facilities, HR/Admin Support
  const isAdminAgent = groups.some(g =>
    g.includes('office admin') ||
    g.includes('admin agent') ||
    g.includes('facilities') ||
    g.includes('procurement') ||
    g.includes('workflow-adminagent') ||
    g.includes('general administration')
  ) || titleStr.includes('office admin') || titleStr.includes('facilities coordinator');

  if (isAdminAgent) return 4;

  // 4. Approver (Role 2)
  // Check for Managers, Approvers, Team Leads, Supervisors, Directors
  const isApprover = groups.some(g =>
    g.includes('managers') ||
    g.includes('approvers') ||
    g.includes('team leads') ||
    g.includes('directors') ||
    g.includes('supervisors') ||
    g.includes('executives') ||
    g.includes('workflow-approver')
  ) || titleStr.includes('manager') || titleStr.includes('director') || titleStr.includes('lead') || titleStr.includes('head') || titleStr.includes('supervisor');

  if (isApprover) return 2;

  // 5. Default: Normal Employee / Requestor (Role 1)
  return 1;
}

/**
 * Escapes special characters in LDAP filter strings according to RFC 4515
 * to prevent LDAP Injection attacks.
 */
export function escapeLdapFilter(input: string): string {
  if (!input) return '';
  return String(input)
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

