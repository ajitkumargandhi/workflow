import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { parse } from 'csv-parse/sync';
import * as bcrypt from 'bcrypt';

export interface UserFilter {
  search?: string;
  department?: string;
  role?: string;
  auth_source?: string;
  is_active?: boolean;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  private cleanString(str: string): string {
    if (!str) return '';
    return str.trim().replace(/^['"]|['"]$/g, '');
  }

  async findAll(filters?: UserFilter): Promise<User[]> {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.manager', 'manager');

    if (filters?.search) {
      qb.andWhere(
        '(user.full_name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }
    if (filters?.department) {
      qb.andWhere('user.department ILIKE :dept', { dept: `%${filters.department}%` });
    }
    if (filters?.role) {
      qb.andWhere('role.role_name = :role', { role: filters.role });
    }
    if (filters?.auth_source) {
      qb.andWhere('user.auth_source = :authSource', { authSource: filters.auth_source });
    }
    if (filters?.is_active !== undefined) {
      qb.andWhere('user.is_active = :isActive', { isActive: filters.is_active });
    }

    return qb.getMany();
  }

  async findActive(): Promise<User[]> {
    return this.userRepository.find({
      where: { is_active: true },
      relations: { role: true, manager: true }
    });
  }

  async findOne(id: string): Promise<User> {
    return this.userRepository.findOne({
      where: { id },
      relations: { role: true, manager: true }
    });
  }

  async findByEmail(email: string): Promise<User> {
    const cleanEmail = this.cleanString(email).toLowerCase();
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.manager', 'manager')
      .where('LOWER(user.email) = LOWER(:email)', { email: cleanEmail })
      .getOne();
  }

  async create(userData: Partial<User> & { role?: any }): Promise<User> {
    if (userData.email) {
      userData.email = this.cleanString(userData.email).toLowerCase();
    }
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    } else {
      userData.password = await bcrypt.hash('user123', 10);
    }
    if (userData.role && typeof userData.role === 'object' && userData.role.id) {
      userData.role = { id: Number(userData.role.id) } as any;
    }
    const user = this.userRepository.create(userData as any) as unknown as User;
    return this.userRepository.save(user);
  }

  async importFromCsv(csvContent: string): Promise<{ success: number; errors: any[] }> {
    let records = [];
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseErr) {
      return { success: 0, errors: [{ error: 'Invalid CSV format: ' + parseErr.message }] };
    }

    let successCount = 0;
    const errors = [];
    const defaultPasswordHash = await bcrypt.hash('user123', 10);

    for (const record of records as any[]) {
      try {
        const rawRoleName = this.cleanString(record.role_name).toLowerCase();
        const mappedRoleName = 
          rawRoleName === 'admin' || rawRoleName === 'it admin' || rawRoleName === 'super admin' ? 'Super Admin' :
          rawRoleName === 'support' || rawRoleName === 'it support' || rawRoleName === 'it agent' ? 'IT Agent' :
          rawRoleName === 'manager' || rawRoleName === 'approver' ? 'Approver' : 'Requestor';
        
        const role = await this.roleRepository.findOneBy({ role_name: mappedRoleName });
        if (!role) throw new Error(`Role ${record.role_name} not found`);

        const email = this.cleanString(record.email).toLowerCase();
        const fullName = this.cleanString(record.full_name);
        const department = this.cleanString(record.department);
        const managerEmail = this.cleanString(record.manager_email);
        const authSource = this.cleanString(record.auth_source) === 'ad' ? 'AD' : 'Local';

        let manager = null;
        if (managerEmail) {
          manager = await this.findByEmail(managerEmail);
        }

        const existingUser = await this.findByEmail(email);
        let user;
        if (existingUser) {
          user = existingUser;
          user.full_name = fullName || user.full_name;
          user.department = department || user.department;
          user.manager = manager || user.manager;
          user.role = role;
          user.auth_source = authSource;
          if (record.password) {
            user.password = await bcrypt.hash(this.cleanString(record.password), 10);
          }
        } else {
          const userPassword = record.password ? await bcrypt.hash(this.cleanString(record.password), 10) : defaultPasswordHash;
          user = this.userRepository.create({
            full_name: fullName,
            email,
            password: userPassword,
            department,
            manager,
            role,
            auth_source: authSource as 'Local' | 'AD',
            is_active: true,
          });
        }

        await this.userRepository.save(user);
        successCount++;
      } catch (e) {
        errors.push({ email: (record as any).email, error: e.message });
      }
    }

    return { success: successCount, errors };
  }

  async update(id: string, userData: any): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id }, relations: { role: true, manager: true } });
    if (!user) throw new NotFoundException('User not found');

    if (userData.password) {
      user.password = await bcrypt.hash(userData.password, 10);
    }
    if (userData.full_name !== undefined) user.full_name = this.cleanString(userData.full_name);
    if (userData.email !== undefined) user.email = this.cleanString(userData.email).toLowerCase();
    if (userData.department !== undefined) user.department = this.cleanString(userData.department);
    if (userData.auth_source !== undefined) user.auth_source = userData.auth_source;
    if (userData.is_active !== undefined) user.is_active = userData.is_active;

    if (userData.role !== undefined) {
      const roleId = Number(userData.role?.id || userData.role || 1);
      user.role = { id: roleId } as any;
    }
    if (userData.manager !== undefined) {
      user.manager = userData.manager ? ({ id: userData.manager.id || userData.manager } as any) : null;
    }

    await this.userRepository.save(user);
    return this.findOne(id);
  }

  async resetPassword(id: string, newPass: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPass, 10);
    await this.userRepository.update(id, { password: hashedPassword });
  }

  async setStatus(id: string, isActive: boolean): Promise<void> {
    await this.userRepository.update(id, { is_active: isActive });
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }
}   
