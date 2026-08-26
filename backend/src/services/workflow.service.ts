import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from '../entities/request.entity';
import { WorkflowStep } from '../entities/workflow-step.entity';
import { ApprovalLog } from '../entities/approval-log.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';

@Injectable()
export class WorkflowService {
  constructor(
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    @InjectRepository(WorkflowStep)
    private workflowStepRepository: Repository<WorkflowStep>,
    @InjectRepository(ApprovalLog)
    private approvalLogRepository: Repository<ApprovalLog>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getStepsForRequest(request: Request): Promise<WorkflowStep[]> {
    const categoryId = typeof request.category === 'object' ? request.category?.id : request.category;
    
    // First try finding workflow steps for exact category
    let steps = await this.workflowStepRepository.find({
      where: { category: { id: categoryId } },
      order: { step_order: 'ASC' },
      relations: { approver_role: true },
    });

    // Fallback to parent category if secondary category has no custom workflow steps defined
    if (steps.length === 0 && request.category?.parent?.id) {
      steps = await this.workflowStepRepository.find({
        where: { category: { id: request.category.parent.id } },
        order: { step_order: 'ASC' },
        relations: { approver_role: true },
      });
    }

    return steps;
  }

  async getCurrentStep(requestId: string): Promise<{ step: Partial<WorkflowStep>; approverRole: Partial<Role> } | null> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: { category: { parent: true } },
    });

    if (!request) throw new NotFoundException('Request not found');

    const logs = await this.approvalLogRepository.find({
      where: { request: { id: requestId } },
      order: { timestamp: 'ASC' },
    });

    const approvedStepsCount = logs.filter(log => log.action === 'Approve').length;
    const steps = await this.getStepsForRequest(request);

    const applicableSteps = steps.filter(step => {
      return !step.min_cost_threshold || Number(request.total_cost) >= Number(step.min_cost_threshold);
    });

    // Default fallback step if no custom workflow steps are mapped
    if (applicableSteps.length === 0) {
      if (approvedStepsCount >= 1) return null;
      return {
        step: { id: 0, step_order: 1, min_cost_threshold: 0, is_mandatory: true },
        approverRole: { id: 2, role_name: 'Approver' },
      };
    }

    if (approvedStepsCount >= applicableSteps.length) {
      return null;
    }

    const currentStep = applicableSteps[approvedStepsCount];
    return {
      step: currentStep,
      approverRole: currentStep.approver_role || { id: 2, role_name: 'Approver' },
    };
  }

  async processAction(requestId: string, approverId: string, action: 'Approve' | 'Reject' | 'SendBack', comments: string): Promise<Request> {
    try {
      const request = await this.requestRepository.findOne({
        where: { id: requestId },
        relations: { category: { parent: true }, requestor: { manager: true }, designated_manager: true }
      });
      if (!request) throw new NotFoundException('Request not found');

      const approver = await this.userRepository.findOne({
        where: { id: approverId },
        relations: { role: true }
      });
      if (!approver) throw new NotFoundException('Approver user not found');

      const currentStepInfo = await this.getCurrentStep(requestId);
      if (!currentStepInfo) {
        throw new BadRequestException('No pending approval step remaining for this request');
      }

      // Log approval decision
      const log = this.approvalLogRepository.create({
        request: { id: requestId },
        approver: { id: approverId },
        action,
        comments: comments || `${action}ed by ${approver.full_name}`,
      });
      await this.approvalLogRepository.save(log);

      let newStatus: Request['status'] = 'Pending';
      if (action === 'Reject') {
        newStatus = 'Rejected';
      } else if (action === 'SendBack') {
        newStatus = 'SentBack';
      } else if (action === 'Approve') {
        const steps = await this.getStepsForRequest(request);
        const applicableSteps = steps.length > 0 
          ? steps.filter(s => !s.min_cost_threshold || Number(request.total_cost) >= Number(s.min_cost_threshold))
          : [{ step_order: 1 }];
        
        const logs = await this.approvalLogRepository.find({ where: { request: { id: requestId } } });
        const approvedCount = logs.filter(l => l.action === 'Approve').length;

        if (approvedCount >= applicableSteps.length) {
          newStatus = 'Approved';
        } else {
          newStatus = 'Pending';
        }
      }

      await this.requestRepository.update(requestId, { status: newStatus, updated_at: new Date() });
      
      return this.requestRepository.findOne({
        where: { id: requestId },
        relations: { category: { parent: true }, requestor: { manager: true } }
      });
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(err.message || 'Error processing manager approval decision');
    }
  }
}
