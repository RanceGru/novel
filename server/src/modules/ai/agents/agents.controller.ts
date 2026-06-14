// Agent API 控制器
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrchestratorService } from './orchestrator.service';
import { DehumanizeService } from './dehumanize.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('AI Agents')
@Controller('ai/agents')
export class AgentsController {
  constructor(
    private orchestrator: OrchestratorService,
    private dehumanizeService: DehumanizeService,
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
    return this.orchestrator.execute(agentName, user.plan, input);
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
