// Token 控制器
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TokenService } from './token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Token')
@Controller('tokens')
export class TokenController {
  constructor(private readonly token: TokenService) {}

  @Get('balance')
  async getBalance(@CurrentUser() user: { id: string }) {
    return this.token.getBalance(user.id);
  }

  @Get('packages')
  async getPackages() {
    return this.token.getPackages();
  }

  @Post('purchase')
  async purchase(@CurrentUser() user: { id: string }, @Body('packageId') packageId: string) {
    return this.token.purchase(user.id, packageId);
  }

  @Get('transactions')
  async getTransactions(
    @CurrentUser() user: { id: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.token.getTransactions(user.id, +(page || 1), +(limit || 20));
  }
}
