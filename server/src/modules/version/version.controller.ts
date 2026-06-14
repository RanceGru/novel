// 版本控制器
import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { VersionService } from './version.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('版本')
@Controller()
export class VersionController {
  constructor(private readonly version: VersionService) {}

  @Get('chapters/:chapterId/versions')
  async getHistory(
    @Param('chapterId') chapterId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('source') source?: string,
  ) {
    return this.version.getHistory(chapterId, +(page || 1), +(limit || 20), source);
  }

  @Get('versions/:versionId')
  async getVersion(@Param('versionId') versionId: string) {
    return this.version.getVersion(versionId);
  }

  @Post('versions/:versionId/revert')
  async revert(
    @Param('versionId') versionId: string,
    @CurrentUser() user: { id: string; plan: string },
  ) {
    return this.version.revert(versionId, user.id, user.plan);
  }
}
