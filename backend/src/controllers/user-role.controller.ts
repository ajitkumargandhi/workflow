import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { UserFilter } from '../services/user.service';
import { RoleService } from '../services/role.service';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {}

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('department') department?: string,
    @Query('role') role?: string,
    @Query('auth_source') auth_source?: string,
    @Query('is_active') is_active?: string,
  ) {
    const filters: UserFilter = {
      search,
      department,
      role,
      auth_source,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
    };
    return this.userService.findAll(filters);
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
  @Roles('Super Admin')
  async create(@Body() userData: Partial<User>) {
    return this.userService.create(userData);
  }

  @Put(':id')
  @Roles('Super Admin')
  async update(@Param('id') id: string, @Body() userData: Partial<User>) {
    return this.userService.update(id, userData);
  }

  @Put(':id/status')
  @Roles('Super Admin')
  async updateStatus(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.userService.setStatus(id, isActive);
  }

  @Put(':id/password')
  @Roles('Super Admin')
  async resetPassword(@Param('id') id: string, @Body('password') password: string) {
    return this.userService.resetPassword(id, password);
  }

  @Delete(':id')
  @Roles('Super Admin')
  async remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Post('import')
  @Roles('Super Admin')
  async importCsv(@Body('csvContent') csvContent: string) {
    return this.userService.importFromCsv(csvContent);
  }
}

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async findAll() {
    return this.roleService.findAll();
  }

  @Post()
  @Roles('Super Admin')
  async create(@Body() roleData: Partial<Role>) {
    return this.roleService.create(roleData);
  }

  @Put(':id')
  @Roles('Super Admin')
  async update(@Param('id') id: string, @Body() roleData: Partial<Role>) {
    return this.roleService.update(+id, roleData);
  }

  @Delete(':id')
  @Roles('Super Admin')
  async remove(@Param('id') id: string) {
    return this.roleService.remove(+id);
  }
}   
