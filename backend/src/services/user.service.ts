import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { parse } from 'csv-parse/sync';
import * as bcrypt from 'bcrypt';

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

  async findAll(): Promise<User[]> {
    return this.userRepository.find({ relations: { role: true, manager: true } });
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
    const cleanEmail = this.cleanString(email);
    return this.userRepository.findOne({
      where: { email: cleanEmail },
      relations: { role: true, manager: true }
    });
  }

  async create(userData: Partial<User>): Promise<User> {
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    } else {
      userData.password = await bcrypt.hash('user123', 10);
    }
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async importFromCsv(csvContent: string): Promise<{ success: number; errors: any[] }> {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

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

        const email = this.cleanString(record.email);
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

  async update(id: string, userData: Partial<User>): Promise<User> {
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }
    await this.userRepository.update(id, userData);
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
