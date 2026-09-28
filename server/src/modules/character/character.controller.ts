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

  // ==================== 角色子项 ====================

  @Get('sections')
  @ApiOperation({ summary: '获取该书全部角色子项（前端按角色分组展开）' })
  async listSections(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }) {
    return this.characterService.listSections(bookId, user.id);
  }

  @Post(':characterId/sections')
  @ApiOperation({ summary: '在指定角色下新建子项' })
  async createSection(
    @Param('characterId') characterId: string,
    @CurrentUser() user: { id: string },
    @Body() body: { title: string; content?: string },
  ) {
    return this.characterService.createSection(characterId, user.id, body);
  }

  @Patch('sections/:sectionId')
  @ApiOperation({ summary: '更新角色子项' })
  async updateSection(
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: { id: string },
    @Body() body: { title?: string; content?: string },
  ) {
    return this.characterService.updateSection(sectionId, user.id, body);
  }

  @Delete('sections/:sectionId')
  @ApiOperation({ summary: '删除角色子项' })
  async deleteSection(@Param('sectionId') sectionId: string, @CurrentUser() user: { id: string }) {
    await this.characterService.deleteSection(sectionId, user.id);
    return { message: '角色子项已删除' };
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
