// 架构师 Agent — 大纲/章纲生成与优化
import { BaseAgent, MemoryContext } from './base.agent';
import { ModelRouterService } from '../model-router.service';

export class ArchitectAgent extends BaseAgent {
  readonly name = 'architect';
  readonly description = 'AI架构师：优化章纲结构，确保情节连贯性和节奏控制';
  readonly requiredTier = 'lite';

  constructor(modelRouter: ModelRouterService) { super(modelRouter); }

  buildPrompt(input: any, memoryContext?: MemoryContext) {
    // 组装记忆上下文
    const memoryParts: string[] = [];
    if (memoryContext?.recentSummary) {
      memoryParts.push(`## 前文摘要\n${memoryContext.recentSummary}`);
    }
    if (memoryContext?.activeForeshadows) {
      memoryParts.push(`## 活跃伏笔（需在本章推进或回收）\n${memoryContext.activeForeshadows}`);
    }
    if (memoryContext?.characterStates) {
      memoryParts.push(`## 角色当前状态\n${memoryContext.characterStates}`);
    }
    const memorySection = memoryParts.length > 0
      ? `\n\n# 当前作品上下文\n${memoryParts.join('\n\n')}`
      : '';

    return {
      system: `你是资深小说架构师。你的任务是根据用户提供的章纲和作品上下文，优化其结构，使其更加完整和有层次。

优化章纲应包含：
1. 核心冲突：本章的主要矛盾是什么？
2. 场景划分：本章分为几个关键场景（2-4个）？
3. 节奏控制：哪些部分详写、哪些略写？
4. 情感走向：本章的情感基调变化
5. 衔接要点：与前章的联系、为后章埋下的伏笔
6. 伏笔处理：如何推进或回收活跃伏笔`,
      user: `原章纲：${input.chapterOutline || '无'}
写作指令：${input.instruction || '无'}${memorySection}

请输出优化后的章纲（JSON格式）：
{"core_conflict":"...","scenes":[{"title":"场景名","content":"场景描述","emphasis":"重点描写"}],"rhythm":"...","emotion_arc":"...","connections":"...","foreshadow_handling":"..."}`,
    };
  }

  parseResult(content: string) {
    return this.extractJSON(content) || { raw: content };
  }
}
