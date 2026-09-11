import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string; frontendUrl?: string }, @Req() req: any) {
    const origin = body.frontendUrl || req.headers.origin || req.headers.referer || (req.protocol + '://' + req.get('host'));
    return this.authService.forgotPassword(body.email, origin);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPasswordWithToken(body.token, body.newPassword);
  }
}
