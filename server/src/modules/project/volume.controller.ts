// 卷控制器
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { VolumeService } from './volume.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('卷')
@Controller('books/:bookId/volumes')
export class VolumeController {
  constructor(private readonly volumeService: VolumeService) {}

  @Get()
  @ApiOperation({ summary: '获取某书籍的所有卷' })
  async list(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }) {
    return this.volumeService.listByBook(bookId, user.id);
  }

  @Post()
  @ApiOperation({ summary: '创建新卷' })
  async create(
    @Param('bookId') bookId: string,
    @CurrentUser() user: { id: string },
    @Body() body: { title: string; volumeNumber: number; summary?: string; outlinePlan?: string },
  ) {
    return this.volumeService.create(bookId, user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新卷' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: { title?: string; summary?: string; status?: string },
  ) {
    return this.volumeService.update(id, user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除卷' })
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.volumeService.delete(id, user.id);
    return { message: '卷已删除' };
  }
}
