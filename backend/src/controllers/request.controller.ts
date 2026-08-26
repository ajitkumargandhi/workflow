import { Controller, Get, Post, Body, Param, Put, Query } from '@nestjs/common';
import { RequestService } from '../services/request.service';
import { WorkflowService } from '../services/workflow.service';
import { Request } from '../entities/request.entity';

@Controller('requests')
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
    }
  ) {
    return this.requestService.createRequest(body.requestData, body.fields, body.attachments);
  }

  @Get()
  async getMyRequests(@Query('userId') userId?: string) {
    return this.requestService.getMyRequests(userId || 'all');
  }

  @Get('actioned')
  async getActionedRequests(@Query('userId') userId?: string) {
    return this.requestService.getActionedRequests(userId || 'all');
  }

  @Get(':id')
  async getRequestDetails(@Param('id') id: string) {
    return this.requestService.getRequestDetails(id);
  }

  @Post(':id/action')
  async takeAction(
    @Param('id') id: string,
    @Body() body: { 
      approverId: string, 
      action: 'Approve' | 'Reject' | 'SendBack', 
      comments: string 
    }
  ) {
    return this.workflowService.processAction(id, body.approverId, body.action, body.comments);
  }

  @Post(':id/work-update')
  async addWorkUpdate(
    @Param('id') id: string,
    @Body() body: { agentId: string; note: string; status?: string }
  ) {
    return this.requestService.addWorkUpdate(id, body.agentId, body.note, body.status);
  }

  @Put(':id/fulfill')
  async fulfill(
    @Param('id') id: string,
    @Body() body: { notes: string; agentId?: string }
  ) {
    return this.requestService.fulfillRequest(id, body.notes, body.agentId);
  }

  @Put(':id/close')
  async close(
    @Param('id') id: string,
    @Body() body: { userId: string; notes?: string }
  ) {
    return this.requestService.closeRequest(id, body.userId, body.notes);
  }
}
