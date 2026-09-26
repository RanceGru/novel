// Agent API 控制器
import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrchestratorService } from './orchestrator.service';
import { DehumanizeService } from './dehumanize.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { MemoryContext } from './base.agent';
import { MemoryService } from '../../memory/memory.service';

@ApiTags('AI Agents')
@Controller('ai/agents')
export class AgentsController {
  private readonly logger = new Logger(AgentsController.name);

  constructor(
    private orchestrator: OrchestratorService,
    private dehumanizeService: DehumanizeService,
    private memoryService: MemoryService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取可用 Agent 列表' })
  async listAgents(@CurrentUser() user: { id: string; plan: string }) {
    return this.orchestrator.getAvailableAgents(user.plan);
  }

  @Post(':agentName')
  @ApiOperation({ summary: '执行指定 Agent' })
  async executeAgent(
    @Param('agentName') agentName: string,
    @CurrentUser() user: { id: string; plan: string },
    @Body() input: any,
  ) {
    // 自动获取记忆上下文（如果请求中包含bookId和chapterId）
    let memoryContext: MemoryContext | undefined;
    if (input.bookId && input.chapterId) {
      try {
        const ctx = await this.memoryService.assembleContext(input.bookId, input.chapterId);
        if (ctx) memoryContext = ctx;
      } catch (e: any) {
        this.logger.warn('Agent记忆上下文获取失败: ' + e.message);
      }
    }
    return this.orchestrator.execute(agentName, user.plan, input, memoryContext);
  }

  @Post('dehumanize/review')
  @ApiOperation({ summary: 'AI去味审查' })
  async dehumanize(
    @CurrentUser() user: { id: string; plan: string },
    @Body() body: { content: string },
  ) {
    return this.dehumanizeService.review(body.content, user.plan);
  }
}
