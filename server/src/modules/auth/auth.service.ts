// 认证服务 — 注册、登录、Token 管理
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { compare, hash } from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from '../user/entities/refresh-token.entity';
import { Subscription } from '../subscription/entities/subscription.entity';
import { TokenBalance } from '../token/entities/token-balance.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { jwtConstants } from '../../config/jwt.config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_COST = 12;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(TokenBalance)
    private tokenBalanceRepository: Repository<TokenBalance>,
    private jwtService: JwtService,
  ) {}

  /** 用户注册 */
  async register(dto: RegisterDto) {
    // 检查邮箱是否已存在
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('该邮箱已被注册');
    }

    // 创建用户
    const passwordHash = await hash(dto.password, this.BCRYPT_COST);
    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName || null,
    });
    await this.userRepository.save(user);

    // 创建默认 Free 订阅
    const subscription = this.subscriptionRepository.create({
      userId: user.id,
      tier: 'free',
      status: 'active',
      autoRenew: true,
      startedAt: new Date(),
    });
    await this.subscriptionRepository.save(subscription);

    // 创建 Token 余额记录
    const tokenBalance = this.tokenBalanceRepository.create({
      userId: user.id,
      purchasedTokensRemaining: 0,
    });
    await this.tokenBalanceRepository.save(tokenBalance);

    // 生成 Token
    return this.generateTokens(user, 'free');
  }

  /** 用户登录 */
  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const isPasswordValid = await compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 获取当前套餐
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId: user.id, status: 'active' },
    });

    // 更新最后登录时间
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return this.generateTokens(user, subscription?.tier || 'free');
  }

  /** 刷新 Token */
  async refresh(refreshTokenStr: string) {
    // 查找 Refresh Token
    const tokenHash = this.hashToken(refreshTokenStr);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new UnauthorizedException('无效的 Refresh Token');
    }
    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Token 已被撤销');
    }
    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException('Refresh Token 已过期，请重新登录');
    }

    // 撤销旧 Token
    storedToken.revokedAt = new Date();
    await this.refreshTokenRepository.save(storedToken);

    // 获取用户
    const user = await this.userRepository.findOne({ where: { id: storedToken.userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { userId: user.id, status: 'active' },
    });

    return this.generateTokens(user, subscription?.tier || 'free');
  }

  /** 登出 */
  async logout(refreshTokenStr: string) {
    const tokenHash = this.hashToken(refreshTokenStr);
    await this.refreshTokenRepository.update(
      { tokenHash },
      { revokedAt: new Date() },
    );
  }

  /** 生成 Access + Refresh Token 对 */
  private async generateTokens(user: User, plan: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      plan,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: jwtConstants.accessExpiresIn,
    });

    // 生成 Refresh Token
    const rawToken = randomBytes(jwtConstants.refreshTokenBytes).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const refreshToken = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天
    });
    await this.refreshTokenRepository.save(refreshToken);

    return {
      accessToken,
      refreshToken: rawToken,
      expiresIn: 15 * 60, // 15分钟（秒）
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt?.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString(),
      },
    };
  }

  /** Token 哈希 */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
