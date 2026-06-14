// 章节控制器
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChapterService } from './chapter.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('章节')
@Controller('volumes/:volumeId/chapters')
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Get()
  @ApiOperation({ summary: '获取某卷的所有章节' })
  async list(@Param('volumeId') volumeId: string, @CurrentUser() user: { id: string }) {
    return this.chapterService.listByVolume(volumeId, user.id);
  }

  @Post()
  @ApiOperation({ summary: '创建新章节' })
  async create(
    @Param('volumeId') volumeId: string,
    @CurrentUser() user: { id: string },
    @Body() body: { title: string; chapterNumber: number; chapterOutline?: string; instruction?: string; content?: string },
  ) {
    return this.chapterService.create(volumeId, user.id, body);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取章节详情（含正文）' })
  async getById(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.chapterService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新章节' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: { title?: string; chapterOutline?: string; instruction?: string; content?: string; summary?: string; status?: string },
  ) {
    return this.chapterService.update(id, user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除章节' })
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.chapterService.delete(id, user.id);
    return { message: '章节已删除' };
  }
}
