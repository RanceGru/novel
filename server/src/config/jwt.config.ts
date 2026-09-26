// JWT 配置
import { JwtModuleOptions } from '@nestjs/jwt';

export function jwtConfig(): JwtModuleOptions {
  const secret = process.env.JWT_SECRET;
  // 生产环境必须设置 JWT_SECRET，开发环境使用固定密钥
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须设置 JWT_SECRET 环境变量');
  }
  return {
    secret: secret || 'novel-dev-secret-not-for-production',
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
