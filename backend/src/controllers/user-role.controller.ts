import { Controller, Get, Post, Body, Param, Put, Delete, UploadedFile, UseInterceptors } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { RoleService } from '../services/role.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {}

  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @Get('active')
  async findActive() {
    return this.userService.findActive();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  async create(@Body() userData: Partial<User>) {
    return this.userService.create(userData);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() userData: Partial<User>) {
    return this.userService.update(id, userData);
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.userService.setStatus(id, isActive);
  }

  @Put(':id/password')
  async resetPassword(@Param('id') id: string, @Body('password') password: string) {
    return this.userService.resetPassword(id, password);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Post('import')
  async importCsv(@Body('csvContent') csvContent: string) {
    return this.userService.importFromCsv(csvContent);
  }
}

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async findAll() {
    return this.roleService.findAll();
  }

  @Post()
  async create(@Body() roleData: Partial<Role>) {
    return this.roleService.create(roleData);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() roleData: Partial<Role>) {
    return this.roleService.update(+id, roleData);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.roleService.remove(+id);
  }
}
