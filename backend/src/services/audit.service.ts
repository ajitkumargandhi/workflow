import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(userId: string, action: string, entityType?: string, entityId?: string, details?: any): Promise<void> {
    const log = this.auditLogRepository.create({
      user: { id: userId },
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
    await this.auditLogRepository.save(log);
  }
}
