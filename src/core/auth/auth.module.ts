/**
 * @file src/core/auth/auth.module.ts
 * @type backend
 * @description Rahyar backend authentication and setup
 */

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GlobalAuthGuard } from './guards/global-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (config: ConfigService): JwtModuleOptions => {
        const jwtSecret = config.get<string>('JWT_SECRET');
        const expiresIn = Number(
          config.get<string>('JWT_EXPIRES_IN') ?? '86400',
        );

        if (!jwtSecret) {
          throw new Error('JWT_SECRET is not defined in .env');
        }

        if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
          throw new Error(
            'JWT_EXPIRES_IN must be a positive number in seconds',
          );
        }

        return {
          secret: jwtSecret,
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy,

    /**
     * اعمال احراز هویت JWT روی تمام endpointهای برنامه.
     *
     * endpointهایی که باید عمومی باشند، باید با decorator زیر مشخص شوند:
     *
     * @Public()
     */
    {
      provide: APP_GUARD,
      useClass: GlobalAuthGuard,
    },
  ],

  exports: [
    AuthService,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
