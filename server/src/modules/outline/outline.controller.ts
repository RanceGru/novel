// 纲树控制器
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OutlineService } from './outline.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('纲树')
@Controller('books/:bookId/outlines')
export class OutlineController {
  constructor(private readonly outlineService: OutlineService) {}

  @Get()
  @ApiOperation({ summary: '获取书籍的完整纲树' })
  async getTree(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }) {
    return this.outlineService.getTree(bookId, user.id);
  }

  @Post()
  @ApiOperation({ summary: '创建纲树节点' })
  async create(
    @Param('bookId') bookId: string,
    @CurrentUser() user: { id: string },
    @Body() body: {
      level: string;
      title: string;
      content?: string;
      parentId?: string;
      volumeId?: string;
      chapterId?: string;
      sortOrder?: number;
    },
  ) {
    return this.outlineService.create(bookId, user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新纲树节点' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: { title?: string; content?: string; parentId?: string; sortOrder?: number },
  ) {
    return this.outlineService.update(id, user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除纲树节点（含子节点）' })
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.outlineService.delete(id, user.id);
    return { message: '纲树节点已删除' };
  }
}
