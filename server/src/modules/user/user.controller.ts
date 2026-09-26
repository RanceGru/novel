// 用户控制器
import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('用户')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  async getProfile(@CurrentUser() user: { id: string }) {
    const u = await this.userService.findById(user.id);
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt?.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString(),
    };
  }

  @Patch('me')
  @ApiOperation({ summary: '更新当前用户信息' })
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() body: { displayName?: string; avatarUrl?: string },
  ) {
    return this.userService.updateProfile(user.id, body);
  }
}
