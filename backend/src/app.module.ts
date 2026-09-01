import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { Category } from './entities/category.entity';
import { Request } from './entities/request.entity';
import { RequestField } from './entities/request-field.entity';
import { RequestAttachment } from './entities/request-attachment.entity';
import { RequestUpdate } from './entities/request-update.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { ApprovalLog } from './entities/approval-log.entity';
import { AuditLog } from './entities/audit-log.entity';
import { UserService } from './services/user.service';
import { RoleService } from './services/role.service';
import { RequestService } from './services/request.service';
import { WorkflowService } from './services/workflow.service';
import { NotificationService } from './services/notification.service';
import { AdminConfigService } from './services/admin-config.service';
import { AuditService } from './services/audit.service';
import { AuthService } from './services/auth.service';
import { UserController, RoleController } from './controllers/user-role.controller';
import { RequestController } from './controllers/request.controller';
import { AdminConfigController } from './controllers/admin-config.controller';
import { AuthController } from './controllers/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'workflow_db',
      entities: [
        Role,
        User,
        Category,
        Request,
        RequestField,
        RequestAttachment,
        RequestUpdate,
        WorkflowStep,
        ApprovalLog,
        AuditLog,
      ],
      autoLoadEntities: true,
      synchronize: false,
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ENTERPRISE_WORKFLOW_JWT_SECRET_KEY_PROD_2026',
      signOptions: { expiresIn: '1d' },
    }),
    TypeOrmModule.forFeature([Role, User, Category, Request, RequestField, RequestAttachment, RequestUpdate, WorkflowStep, ApprovalLog, AuditLog]),
  ],
  controllers: [UserController, RoleController, RequestController, AdminConfigController, AuthController],
  providers: [UserService, RoleService, RequestService, WorkflowService, NotificationService, AdminConfigService, AuditService, AuthService, JwtAuthGuard],
})
export class AppModule {}
