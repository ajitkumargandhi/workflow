import { Controller, Get, Post, Body, Param, Put, Query, UseGuards, Req } from '@nestjs/common';
import { RequestService } from '../services/request.service';
import { WorkflowService } from '../services/workflow.service';
import { Request } from '../entities/request.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestController {
  constructor(
    private readonly requestService: RequestService,
    private readonly workflowService: WorkflowService,
  ) {}

  @Post()
  async create(
    @Body() body: { 
      requestData: Partial<Request> & { category_id?: number; designated_manager_id?: string }, 
      fields: any[], 
      attachments: any[] 
    },
    @Req() req: any
  ) {
    // Ensure requestor is the authenticated user if not explicitly specified
    if (!body.requestData.requestor && req.user?.sub) {
      body.requestData.requestor = { id: req.user.sub } as any;
    }
    return this.requestService.createRequest(body.requestData, body.fields, body.attachments);
  }

  @Get()
  async getMyRequests(@Req() req: any, @Query('userId') userId?: string) {
    const currentUserId = req.user?.sub;
    const currentUserRole = req.user?.role;
    const isElevated = currentUserRole === 'Super Admin' || currentUserRole === 'Admin Agent' || currentUserRole === 'IT Agent';
    const targetUserId = isElevated ? (userId || currentUserId || 'all') : (currentUserId || userId || 'all');
    return this.requestService.getMyRequests(targetUserId);
  }

  @Get('actioned')
  async getActionedRequests(@Req() req: any, @Query('userId') userId?: string) {
    const currentUserId = req.user?.sub;
    const currentUserRole = req.user?.role;
    const isElevated = currentUserRole === 'Super Admin' || currentUserRole === 'Admin Agent';
    const targetUserId = isElevated ? (userId || currentUserId || 'all') : (currentUserId || userId);
    return this.requestService.getActionedRequests(targetUserId);
  }

  @Get(':id')
  async getRequestDetails(@Param('id') id: string) {
    return this.requestService.getRequestDetails(id);
  }

  @Post(':id/action')
  async takeAction(
    @Param('id') id: string,
    @Body() body: { 
      approverId?: string, 
      action: 'Approve' | 'Reject' | 'SendBack', 
      comments: string 
    },
    @Req() req: any
  ) {
    const approverId = req.user?.sub || body.approverId;
    return this.workflowService.processAction(id, approverId, body.action, body.comments);
  }

  @Post(':id/work-update')
  async addWorkUpdate(
    @Param('id') id: string,
    @Body() body: { agentId?: string; note: string; status?: string },
    @Req() req: any
  ) {
    const agentId = req.user?.sub || body.agentId;
    return this.requestService.addWorkUpdate(id, agentId, body.note, body.status);
  }

  @Put(':id/fulfill')
  async fulfill(
    @Param('id') id: string,
    @Body() body: { notes: string; agentId?: string },
    @Req() req: any
  ) {
    const agentId = req.user?.sub || body.agentId;
    return this.requestService.fulfillRequest(id, body.notes, agentId);
  }

  @Put(':id/close')
  async close(
    @Param('id') id: string,
    @Body() body: { userId?: string; notes?: string },
    @Req() req: any
  ) {
    const userId = req.user?.sub || body.userId;
    return this.requestService.closeRequest(id, userId, body.notes);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: {
      justification?: string;
      total_cost?: number;
      currency?: string;
      fulfillment_type?: string;
      designated_manager_id?: string;
      status?: 'Pending' | 'Approved' | 'In Progress' | 'Rejected' | 'SentBack' | 'Fulfilled' | 'Closed';
    }
  ) {
    return this.requestService.updateRequest(id, body);
  }
}
