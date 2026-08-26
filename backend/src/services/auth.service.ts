import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private resetTokens: Map<string, { userId: string; expires: number }> = new Map();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.userRepository.createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.manager', 'manager')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.is_active === false) {
      throw new UnauthorizedException('User account is disabled');
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: user.id, email: user.email, role: user.role?.role_name };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        department: user.department,
        role: user.role?.role_name,
        manager: user.manager ? { id: user.manager.id, full_name: user.manager.full_name, email: user.manager.email } : null,
      },
    };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return { message: 'If that account exists, a password reset token has been generated and dispatched.' };
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expires = Date.now() + 3600000; // 1 hour
    this.resetTokens.set(token, { userId: user.id, expires });

    return {
      message: 'Password reset email notification generated successfully.',
      resetToken: token,
      expiresIn: '1 hour',
    };
  }

  async resetPasswordWithToken(token: string, newPass: string) {
    const record = this.resetTokens.get(token);
    if (!record || Date.now() > record.expires) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const hashedPassword = await bcrypt.hash(newPass, 10);
    await this.userRepository.update(record.userId, { password: hashedPassword });
    this.resetTokens.delete(token);

    return { message: 'Password has been reset successfully. You may now log in.' };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
