// 同步控制器
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('同步')
@Controller('sync')
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('export-book/:bookId')
  @ApiOperation({ summary: '导出书籍数据包（供离线下载）' })
  async exportBook(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }) {
    return this.syncService.exportBook(bookId, user.id);
  }

  @Post('import-operations')
  @ApiOperation({ summary: '提交离线操作日志' })
  async importOperations(
    @CurrentUser() user: { id: string },
    @Body() body: { operations: any[] },
  ) {
    return this.syncService.importOperations(user.id, body.operations || []);
  }

  @Get('conflicts')
  @ApiOperation({ summary: '获取未解决的冲突' })
  getConflicts() {
    return this.syncService.getConflicts();
  }

  @Post('resolve-conflict')
  @ApiOperation({ summary: '解决冲突' })
  resolveConflict(@Body() body: { conflictId: string; resolution: 'keep_local' | 'keep_remote' | 'merge' }) {
    return this.syncService.resolveConflict(body.conflictId, body.resolution);
  }
}
