import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from '../entities/request.entity';
import { RequestField } from '../entities/request-field.entity';
import { RequestAttachment } from '../entities/request-attachment.entity';
import { RequestUpdate } from '../entities/request-update.entity';
import { ApprovalLog } from '../entities/approval-log.entity';
import { User } from '../entities/user.entity';
import { Category } from '../entities/category.entity';
import { WorkflowService } from './workflow.service';

@Injectable()
export class RequestService {
  constructor(
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    @InjectRepository(RequestField)
    private requestFieldRepository: Repository<RequestField>,
    @InjectRepository(RequestAttachment)
    private requestAttachmentRepository: Repository<RequestAttachment>,
    @InjectRepository(RequestUpdate)
    private requestUpdateRepository: Repository<RequestUpdate>,
    @InjectRepository(ApprovalLog)
    private approvalLogRepository: Repository<ApprovalLog>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private workflowService: WorkflowService,
  ) {}

  private async enrichRequest(req: Request): Promise<any> {
    let currentStep = null;
    try {
      currentStep = await this.workflowService.getCurrentStep(req.id);
    } catch (e) {
      // Ignore
    }
    return {
      ...req,
      primary_category: req.category?.parent?.name || req.category?.name || 'General',
      secondary_category: req.category?.parent ? req.category.name : 'N/A',
      current_step: currentStep,
    };
  }

  async createRequest(
    data: Partial<Request> & { category_id?: number; designated_manager_id?: string },
    fields?: Array<{ key: string; value: string }>,
    attachments?: Array<{ name: string; path: string; type?: string }>
  ): Promise<Request> {
    const trackingId = `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const categoryId = data.category_id || data.category?.id;

    // Check if fulfillment_type is Re-issue from Stock -> set cost to 0
    let totalCost = data.total_cost || 0;
    if (data.fulfillment_type === 'Re-issue from Stock') {
      totalCost = 0;
    }

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
      relations: { parent: true },
    });

    let initialStatus: Request['status'] = 'Pending';
    if (category) {
      const isSupport = category.name.toLowerCase().includes('support') || 
                        (category.parent && category.parent.name.toLowerCase().includes('support'));
      if (isSupport) {
        initialStatus = 'Approved';
      }
    }

    const newRequest = this.requestRepository.create({
      tracking_id: trackingId,
      requestor: data.requestor ? { id: data.requestor.id } : null,
      designated_manager: data.designated_manager_id ? { id: data.designated_manager_id } : null,
      category: { id: categoryId },
      total_cost: totalCost,
      currency: data.currency || 'USD',
      fulfillment_type: data.fulfillment_type || 'New Purchase',
      justification: data.justification,
      urgency: data.urgency || 'Medium',
      status: initialStatus,
    });

    const savedRequest = await this.requestRepository.save(newRequest);

    if (fields && fields.length > 0) {
      const fieldEntities = fields.map(f =>
        this.requestFieldRepository.create({
          request: savedRequest,
          field_key: f.key,
          field_value: f.value,
        })
      );
      await this.requestFieldRepository.save(fieldEntities);
    }

    if (attachments && attachments.length > 0) {
      const attachmentEntities = attachments.map(a =>
        this.requestAttachmentRepository.create({
          request: savedRequest,
          file_name: a.name,
          file_path: a.path,
          file_type: a.type || 'unknown',
        })
      );
      await this.requestAttachmentRepository.save(attachmentEntities);
    }

    return savedRequest;
  }

  async getMyRequests(userId: string): Promise<any[]> {
    let requests;
    if (userId === 'all') {
      requests = await this.requestRepository.find({
        relations: { category: { parent: true }, requestor: { manager: true }, designated_manager: true, assigned_agent: true },
        order: { created_at: 'DESC' },
      });
    } else {
      requests = await this.requestRepository.find({
        where: { requestor: { id: userId } },
        relations: { category: { parent: true }, requestor: { manager: true }, designated_manager: true, assigned_agent: true },
        order: { created_at: 'DESC' },
      });
    }

    return Promise.all(requests.map(req => this.enrichRequest(req)));
  }

  async getActionedRequests(userId: string): Promise<any[]> {
    if (userId === 'all') {
      return this.getMyRequests('all');
    }

    // Find request IDs from approval_logs where approver_id = userId
    const logs = await this.approvalLogRepository.find({
      where: { approver: { id: userId } },
      relations: { request: true },
    });

    // Find request IDs from request_updates where agent_id = userId
    const updates = await this.requestUpdateRepository.find({
      where: { agent: { id: userId } },
      relations: { request: true },
    });

    const directAssigned = await this.requestRepository.find({
      where: [
        { assigned_agent: { id: userId } },
        { designated_manager: { id: userId } },
      ],
      relations: { category: { parent: true }, requestor: { manager: true }, designated_manager: true, assigned_agent: true },
    });

    const requestIds = Array.from(new Set([
      ...logs.map(l => l.request?.id).filter(Boolean),
      ...updates.map(u => u.request?.id).filter(Boolean),
      ...directAssigned.map(r => r.id),
    ]));

    if (requestIds.length === 0) return [];

    const requests = await this.requestRepository.find({
      where: requestIds.map(id => ({ id })),
      relations: { category: { parent: true }, requestor: { manager: true }, designated_manager: true, assigned_agent: true },
      order: { updated_at: 'DESC' },
    });

    return Promise.all(requests.map(req => this.enrichRequest(req)));
  }

  async getRequestDetails(id: string): Promise<any> {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: {
        category: { parent: true },
        requestor: { manager: true, role: true },
        designated_manager: true,
        assigned_agent: true,
        closed_by: true,
      },
    });

    if (!request) throw new NotFoundException('Request not found');

    const fields = await this.requestFieldRepository.find({ where: { request: { id } } });
    const attachments = await this.requestAttachmentRepository.find({ where: { request: { id } } });
    const logs = await this.approvalLogRepository.find({
      where: { request: { id } },
      relations: { approver: { role: true } },
      order: { timestamp: 'ASC' },
    });
    const updates = await this.requestUpdateRepository.find({
      where: { request: { id } },
      relations: { agent: true },
      order: { timestamp: 'ASC' },
    });

    let currentStep = null;
    try {
      currentStep = await this.workflowService.getCurrentStep(id);
    } catch (e) {
      // Ignore
    }

    return {
      ...request,
      primary_category: request.category?.parent?.name || request.category?.name || 'General',
      secondary_category: request.category?.parent ? request.category.name : 'N/A',
      current_step: currentStep,
      fields,
      attachments,
      logs,
      updates,
    };
  }

  async addWorkUpdate(requestId: string, agentId: string, note: string, newStatus?: string): Promise<RequestUpdate> {
    const request = await this.requestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    const agent = await this.userRepository.findOne({ where: { id: agentId } });

    const update = this.requestUpdateRepository.create({
      request: { id: requestId },
      agent: agent ? { id: agentId } : null,
      status: newStatus || request.status,
      note,
    });

    const savedUpdate = await this.requestUpdateRepository.save(update);

    if (newStatus && newStatus !== request.status) {
      await this.requestRepository.update(requestId, { status: newStatus as any, updated_at: new Date() });
    }

    return savedUpdate;
  }

  async fulfillRequest(id: string, notes: string, agentId?: string): Promise<Request> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');

    await this.requestRepository.update(id, {
      status: 'Fulfilled',
      fulfillment_notes: notes,
      assigned_agent: agentId ? { id: agentId } : request.assigned_agent,
      updated_at: new Date(),
    });

    if (agentId) {
      await this.addWorkUpdate(id, agentId, `Fulfilled request: ${notes}`, 'Fulfilled');
    }

    return this.requestRepository.findOne({
      where: { id },
      relations: { category: { parent: true }, requestor: { manager: true }, designated_manager: true, assigned_agent: true },
    });
  }

  async closeRequest(id: string, userId: string, closureNotes?: string): Promise<Request> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');

    await this.requestRepository.update(id, {
      status: 'Closed',
      closed_at: new Date(),
      closed_by: { id: userId },
      updated_at: new Date(),
    });

    await this.addWorkUpdate(id, userId, closureNotes || 'Request formally closed and confirmed completed.', 'Closed');

    return this.requestRepository.findOne({
      where: { id },
      relations: { category: { parent: true }, requestor: { manager: true }, designated_manager: true },
    });
  }

  async updateRequest(
    id: string,
    data: {
      justification?: string;
      total_cost?: number;
      currency?: string;
      fulfillment_type?: string;
      designated_manager_id?: string;
      status?: 'Pending' | 'Approved' | 'In Progress' | 'Rejected' | 'SentBack' | 'Fulfilled' | 'Closed';
    }
  ): Promise<Request> {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: { category: { parent: true } }
    });
    if (!request) throw new NotFoundException('Request not found');

    const updateData: Partial<Request> = {};
    if (data.justification !== undefined) updateData.justification = data.justification;
    if (data.total_cost !== undefined) {
      updateData.total_cost = data.fulfillment_type === 'Re-issue from Stock' ? 0 : data.total_cost;
    }
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.fulfillment_type !== undefined) updateData.fulfillment_type = data.fulfillment_type;
    if (data.designated_manager_id !== undefined) {
      updateData.designated_manager = { id: data.designated_manager_id } as any;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.status === 'Pending') {
      await this.approvalLogRepository.delete({ request: { id } });
    }

    await this.requestRepository.update(id, { ...updateData, updated_at: new Date() });
    return this.requestRepository.findOne({ where: { id }, relations: { category: { parent: true } } });
  }
}
