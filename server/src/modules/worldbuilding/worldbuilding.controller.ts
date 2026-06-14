// 世界观控制器
import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WorldbuildingService } from './worldbuilding.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('世界观')
@Controller('books/:bookId/world-settings')
export class WorldbuildingController {
  constructor(private readonly wb: WorldbuildingService) {}

  @Get()
  async list(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }, @Query('category') category?: string) {
    return this.wb.list(bookId, user.id, category);
  }

  @Post()
  async create(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }, @Body() body: any) {
    return this.wb.create(bookId, user.id, body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @CurrentUser() user: { id: string }, @Body() body: any) {
    return this.wb.update(id, user.id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.wb.delete(id, user.id);
    return { message: '设定已删除' };
  }
}
