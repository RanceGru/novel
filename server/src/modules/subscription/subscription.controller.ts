// 订阅控制器
import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('订阅')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly sub: SubscriptionService) {}

  @Get('plans')
  @ApiOperation({ summary: '获取所有套餐' })
  getPlans() {
    return this.sub.getPlans();
  }

  @Get('current')
  @ApiOperation({ summary: '当前套餐' })
  getCurrent(@CurrentUser() user: { id: string }) {
    return this.sub.getCurrent(user.id);
  }

  @Get('usage')
  @ApiOperation({ summary: '使用统计' })
  getUsage(@CurrentUser() user: { id: string }) {
    return this.sub.getUsage(user.id);
  }

  @Post('subscribe')
  @ApiOperation({ summary: '订阅/升级套餐' })
  subscribe(@CurrentUser() user: { id: string }, @Body('tier') tier: string) {
    return this.sub.subscribe(user.id, tier);
  }

  @Post('cancel')
  @ApiOperation({ summary: '取消自动续费' })
  cancel(@CurrentUser() user: { id: string }) {
    return this.sub.cancel(user.id);
  }
}
