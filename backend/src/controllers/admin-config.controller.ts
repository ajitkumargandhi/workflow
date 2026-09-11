import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { AdminConfigService } from '../services/admin-config.service';
import { NotificationService } from '../services/notification.service';
import { Category } from '../entities/category.entity';
import { WorkflowStep } from '../entities/workflow-step.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminConfigController {
  constructor(
    private readonly adminConfigService: AdminConfigService,
    private readonly notificationService: NotificationService,
  ) { }

  @Get('categories')
  async getCategories() {
    return this.adminConfigService.getCategoryTree();
  }

  @Post('categories')
  @Roles('Super Admin', 'Admin Agent')
  async createCategory(@Body() data: Partial<Category>) {
    return this.adminConfigService.createCategory(data);
  }

  @Put('categories/:id')
  @Roles('Super Admin', 'Admin Agent')
  async updateCategory(@Param('id') id: string, @Body() data: Partial<Category>) {
    return this.adminConfigService.updateCategory(+id, data);
  }

  @Delete('categories/:id')
  @Roles('Super Admin', 'Admin Agent')
  async deleteCategory(@Param('id') id: string) {
    return this.adminConfigService.deleteCategory(+id);
  }

  @Get('workflows/:categoryId')
  async getWorkflow(@Param('categoryId') categoryId: string) {
    return this.adminConfigService.getWorkflowForCategory(+categoryId);
  }

  @Post('workflows/:categoryId')
  @Roles('Super Admin', 'Admin Agent')
  async setWorkflow(@Param('categoryId') categoryId: string, @Body() steps: Partial<WorkflowStep>[]) {
    return this.adminConfigService.setWorkflowSteps(+categoryId, steps);
  }

  @Get('server')
  @Roles('Super Admin')
  async getServerConfig() {
    return this.adminConfigService.getServerConfig();
  }

  @Post('server')
  @Roles('Super Admin')
  async saveServerConfig(@Body() config: any) {
    return this.adminConfigService.updateServerConfig(config);
  }

  @Post('sync-ldap')
  @Roles('Super Admin')
  async syncLdap() {
    return this.adminConfigService.syncLdapUsers();
  }

  @Post('test-ldap')
  @Roles('Super Admin')
  async testLdap() {
    return this.adminConfigService.testLdapConnection();
  }

  @Post('test-smtp')
  @Roles('Super Admin')
  async testSmtp(@Body('testEmail') testEmail?: string) {
    return this.notificationService.testSmtpConnection(testEmail);
  }

  @Get('backup')
  @Roles('Super Admin')
  async exportBackup() {
    return this.adminConfigService.exportDatabaseBackup();
  }

  @Post('restore')
  @Roles('Super Admin')
  async restoreBackup(@Body() body: any) {
    return this.adminConfigService.restoreDatabaseBackup(body);
  }
}

