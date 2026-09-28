// 纲树控制器
//
// 结构：大纲（单例，只能改写内容） / 卷纲（1:1 对应分卷） / 章纲（1:1 对应章节）
// 均通过 level 字段区分，挂在同一张 outlines 表上。
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OutlineService } from './outline.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('纲树')
@Controller('books/:bookId/outlines')
export class OutlineController {
  constructor(private readonly outlineService: OutlineService) {}

  @Get()
  @ApiOperation({ summary: '获取纲树分组视图（大纲 / 卷纲 / 章纲，含同步状态）' })
  async getGroups(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }) {
    return this.outlineService.getGroups(bookId, user.id);
  }

  @Get('tree')
  @ApiOperation({ summary: '获取完整纲树（兼容旧接口）' })
  async getTree(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }) {
    return this.outlineService.getTree(bookId, user.id);
  }

  @Patch('book-outline')
  @ApiOperation({ summary: '更新大纲内容（标题固定为「大纲」）' })
  async updateBookOutline(
    @Param('bookId') bookId: string,
    @CurrentUser() user: { id: string },
    @Body('content') content: string,
  ) {
    return this.outlineService.updateBookOutline(bookId, user.id, content);
  }

  @Post()
  @ApiOperation({ summary: '创建卷纲或章纲（大纲不可新增）' })
  async create(
    @Param('bookId') bookId: string,
    @CurrentUser() user: { id: string },
    @Body() body: {
      level: string;
      title: string;
      content?: string;
      parentId?: string;
      sortOrder?: number;
    },
  ) {
    return this.outlineService.create(bookId, user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新纲条目（大纲的标题不可改）' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: { title?: string; content?: string; sortOrder?: number },
  ) {
    return this.outlineService.update(id, user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除卷纲或章纲（大纲不可删）' })
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.outlineService.delete(id, user.id);
    return { message: '纲条目已删除' };
  }

  @Post(':id/generate-chapter')
  @ApiOperation({ summary: '由章纲生成章节（写入章纲快照与指纹）' })
  async generateChapter(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.outlineService.generateChapter(id, user.id);
  }

  @Post(':id/generate-volume')
  @ApiOperation({ summary: '由卷纲生成分卷（1:1）' })
  async generateVolume(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.outlineService.generateVolume(id, user.id);
  }
}
