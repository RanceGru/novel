// JWT 配置
import { JwtModuleOptions } from '@nestjs/jwt';

export function jwtConfig(): JwtModuleOptions {
  return {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    signOptions: {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    },
  };
}

export const jwtConstants = {
  accessExpiresIn: '15m',
  refreshExpiresIn: '30d',
  refreshTokenBytes: 64,
};
