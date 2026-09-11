import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('server_config')
export class ServerConfig {
  @PrimaryColumn({ default: 1 })
  id: number;

  @Column({ default: 'Enterprise Workflow Engine' })
  system_name: string;

  @Column({ default: 60 })
  session_timeout: number;

  @Column({ default: false })
  maintenance_mode: boolean;

  @Column({ default: true })
  ldap_enabled: boolean;

  @Column({ default: 'ldap://ad.company.local:389' })
  ldap_url: string;

  @Column({ default: 'DC=company,DC=local' })
  ldap_base_dn: string;

  @Column({ default: 'CN=Admin,DC=company,DC=local' })
  ldap_bind_dn: string;

  @Column({ default: 'Secret123' })
  ldap_bind_password: string;

  @Column({ default: 'smtp.company.com' })
  smtp_host: string;

  @Column({ default: 587 })
  smtp_port: number;

  @Column({ default: 'notifications@company.com' })
  smtp_user: string;

  @Column({ default: 'SmtpSecret123' })
  smtp_password: string;

  @Column({ default: 'STARTTLS' })
  smtp_protocol: string;
}
