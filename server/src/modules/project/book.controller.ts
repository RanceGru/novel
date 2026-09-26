// 书籍控制器
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BookService } from './book.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('书籍')
@Controller('books')
export class BookController {
  constructor(private readonly bookService: BookService) {}

  @Get()
  @ApiOperation({ summary: '获取当前用户的所有书籍' })
  async list(@CurrentUser() user: { id: string }) {
    return this.bookService.listByUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: '创建新书籍' })
  async create(
    @CurrentUser() user: { id: string },
    @Body() body: { title: string; subtitle?: string; author?: string; description?: string },
  ) {
    return this.bookService.create(user.id, body);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取书籍详情' })
  async getById(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const book = await this.bookService.findById(id);
    if (book.userId !== user.id) {
      throw new Error('无权访问');
    }
    return book;
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新书籍' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: { title?: string; subtitle?: string; author?: string; description?: string; status?: string },
  ) {
    return this.bookService.update(id, user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除书籍' })
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.bookService.delete(id, user.id);
    return { message: '书籍已删除' };
  }
}
