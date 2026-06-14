// Agent 编排器 — 注册、调度、结果整合
import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent, AgentResult } from './base.agent';
import { ArchitectAgent } from './architect.agent';
import { CharacterDesignerAgent } from './character-designer.agent';
import { QualityInspectorAgent } from './quality-inspector.agent';
import { StyleMimicAgent } from './style-mimic.agent';
import { WorldBuilderAgent } from './world-builder.agent';
import { ModelRouterService } from '../model-router.service';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);
  private agents: Map<string, BaseAgent> = new Map();

  constructor(private modelRouter: ModelRouterService) {
    this.register(new ArchitectAgent(modelRouter));
    this.register(new CharacterDesignerAgent(modelRouter));
    this.register(new QualityInspectorAgent(modelRouter));
    this.register(new StyleMimicAgent(modelRouter));
    this.register(new WorldBuilderAgent(modelRouter));
  }

  register(agent: BaseAgent) {
    this.agents.set(agent.name, agent);
    this.logger.log(`Agent 已注册: ${agent.name}`);
  }

  /** 获取用户可用的 Agent 列表 */
  getAvailableAgents(userPlan: string) {
    const result: { name: string; description: string; available: boolean }[] = [];
    for (const agent of this.agents.values()) {
      result.push({
        name: agent.name,
        description: agent.description,
        available: agent.canExecute(userPlan),
      });
    }
    return result;
  }

  /** 执行单个 Agent */
  async execute(agentName: string, userPlan: string, input: any): Promise<AgentResult> {
    const agent = this.agents.get(agentName);
    if (!agent) return { success: false, error: `Agent "${agentName}" 不存在`, metadata: null as any };
    return agent.execute(userPlan, input);
  }

  /** 并行执行多个 Agent */
  async executeParallel(agentNames: string[], userPlan: string, input: any): Promise<Record<string, AgentResult>> {
    const results: Record<string, AgentResult> = {};
    await Promise.all(
      agentNames.map(async (name) => {
        results[name] = await this.execute(name, userPlan, input);
      }),
    );
    return results;
  }

  /** 生成前预处理：可选的架构师+文风模拟师 */
  async preGenerate(userPlan: string, params: {
    bookId: string; chapterOutline: string; instruction: string; styleSample?: string;
  }) {
    const results: any = {};

    // 架构师处理章纲（Lite+）
    if (this.agents.get('architect')?.canExecute(userPlan)) {
      const r = await this.execute('architect', userPlan, { chapterOutline: params.chapterOutline, instruction: params.instruction });
      if (r.success) results.refinedOutline = r.data;
    }

    // 文风模拟（Pro）
    if (params.styleSample && this.agents.get('style-mimic')?.canExecute(userPlan)) {
      const r = await this.execute('style-mimic', userPlan, { sampleText: params.styleSample });
      if (r.success) results.styleParams = r.data;
    }

    return results;
  }

  /** 生成后处理：质检（Basic+） */
  async postGenerate(userPlan: string, params: {
    chapterContent: string; chapterOutline: string; characters: string;
  }) {
    const results: any = {};

    if (this.agents.get('quality-inspector')?.canExecute(userPlan)) {
      const r = await this.execute('quality-inspector', userPlan, params);
      if (r.success) results.review = r.data;
    }

    return results;
  }
}
