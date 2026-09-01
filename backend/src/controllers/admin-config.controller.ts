import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { AdminConfigService } from '../services/admin-config.service';
import { Category } from '../entities/category.entity';
import { WorkflowStep } from '../entities/workflow-step.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('admin/config')
@UseGuards(JwtAuthGuard)
export class AdminConfigController {
  constructor(private readonly adminConfigService: AdminConfigService) {}

  @Get('categories')
  async getCategories() {
    return this.adminConfigService.getCategoryTree();
  }

  @Post('categories')
  async createCategory(@Body() data: Partial<Category>) {
    return this.adminConfigService.createCategory(data);
  }

  @Put('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() data: Partial<Category>) {
    return this.adminConfigService.updateCategory(+id, data);
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    return this.adminConfigService.deleteCategory(+id);
  }

  @Get('workflows/:categoryId')
  async getWorkflow(@Param('categoryId') categoryId: string) {
    return this.adminConfigService.getWorkflowForCategory(+categoryId);
  }

  @Post('workflows/:categoryId')
  async setWorkflow(@Param('categoryId') categoryId: string, @Body() steps: Partial<WorkflowStep>[]) {
    return this.adminConfigService.setWorkflowSteps(+categoryId, steps);
  }

  @Get('server')
  async getServerConfig() {
    return this.adminConfigService.getServerConfig();
  }

  @Post('server')
  async saveServerConfig(@Body() config: any) {
    return this.adminConfigService.updateServerConfig(config);
  }

  @Post('sync-ldap')
  async syncLdap() {
    return this.adminConfigService.syncLdapUsers();
  }

  @Get('backup')
  async exportBackup() {
    return this.adminConfigService.exportDatabaseBackup();
  }

  @Post('restore')
  async restoreBackup(@Body() body: any) {
    return this.adminConfigService.restoreDatabaseBackup(body);
  }
}
