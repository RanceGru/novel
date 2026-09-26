// 角色控制器
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CharacterService } from './character.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('角色')
@Controller('books/:bookId/characters')
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

  @Get()
  async list(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }) {
    return this.characterService.list(bookId, user.id);
  }

  @Post()
  async create(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }, @Body() body: any) {
    return this.characterService.create(bookId, user.id, body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @CurrentUser() user: { id: string }, @Body() body: any) {
    return this.characterService.update(id, user.id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.characterService.delete(id, user.id);
    return { message: '角色已删除' };
  }

  @Get('character-graph')
  async getGraph(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }) {
    return this.characterService.getGraph(bookId, user.id);
  }

  @Post('relations')
  async createRelation(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }, @Body() body: any) {
    return this.characterService.createRelation(bookId, user.id, body);
  }

  @Delete('relations/:relationId')
  async deleteRelation(@Param('relationId') relationId: string, @CurrentUser() user: { id: string }) {
    await this.characterService.deleteRelation(relationId, user.id);
    return { message: '关系已删除' };
  }
}
