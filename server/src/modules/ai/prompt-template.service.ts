// Prompt 模板引擎 — 结构化模板版本 (v2.7)
import { Injectable } from '@nestjs/common';

export interface ChapterGenerationParams {
  chapterOutline: string;
  instruction: string;
  targetWordCount: number;
  contextSummary?: string;
  characters?: string;
  worldSettings?: string;
  styleParams?: string;
}

@Injectable()
export class PromptTemplateService {
  /** 组装章节生成 Prompt（结构化模板） */
  buildChapterGenerationPrompt(params: ChapterGenerationParams): { systemPrompt: string; userMessage: string } {
    const systemPrompt = `你是一位专业的网文小说作家。你的任务是根据提供的章纲、角色设定、世界观背景和写作指令，生成高质量的章节正文。

## 核心写作原则：
1. **情节驱动**：严格按照章纲的情节结构展开，不得偏离主线
2. **角色一致**：所有角色行为必须符合其人设和当前状态，不得OOC
3. **伏笔处理**：留意活跃伏笔列表，在合适的场景推进或回收
4. **世界观严守**：所有设定描述必须与提供的世界观信息一致
5. **风格贯彻**：遵循风格参数中的句式、描写、对话特征
6. **语言自然**：避免AI说教感、模板化过渡词、重复句式
7. **详略得当**：重点情节详细展开（场景+对话+心理），过渡情节简洁
8. **目标字数**：约 ${params.targetWordCount} 字，合理分配各场景篇幅
9. **只输出正文**：不要添加章节标题、解释说明或元注释`;

    const userMessageParts: string[] = [];

    // —— 角色信息段 ——
    if (params.characters) {
      userMessageParts.push(`## 角色设定\n${params.characters}`);
    }

    // —— 世界观设定段 ——
    if (params.worldSettings) {
      userMessageParts.push(`## 世界观背景\n${params.worldSettings}`);
    }

    // —— 前文回顾+伏笔+角色状态（记忆上下文） ——
    if (params.contextSummary) {
      userMessageParts.push(`${params.contextSummary}`);
    }

    // —— 风格参数段 ——
    if (params.styleParams) {
      userMessageParts.push(`## 风格参数\n${params.styleParams}`);
    }

    // —— 本章写作任务 ——
    userMessageParts.push(`## 本章章纲\n${params.chapterOutline}`);

    if (params.instruction) {
      userMessageParts.push(`## 写作指令\n${params.instruction}`);
    }

    userMessageParts.push(`## 任务\n请根据以上所有上下文信息，生成本章节的完整正文。目标字数：${params.targetWordCount} 字。`);

    return {
      systemPrompt,
      userMessage: userMessageParts.join('\n\n'),
    };
  }

  /** 组装章纲生成 Prompt */
  buildChapterOutlinePrompt(params: {
    context: string;
    instruction?: string;
    characters?: string;
  }): { systemPrompt: string; userMessage: string } {
    const userParts: string[] = [];

    if (params.characters) {
      userParts.push(`## 角色信息\n${params.characters}`);
    }

    userParts.push(`## 上下文信息\n${params.context}`);

    if (params.instruction) {
      userParts.push(`## 额外要求\n${params.instruction}`);
    }

    userParts.push('## 任务\n请生成本章的详细章纲。');

    return {
      systemPrompt: `你是一位专业的小说大纲策划师。请根据提供的角色信息和上下文，生成详细的章纲。

章纲应包含：
1. 本章核心情节（2-3 个关键场景）
2. 主要人物的行为目标与对话方向
3. 情感基调与节奏控制
4. 与前后章节的衔接要点
5. 需要推进或回收的伏笔（如有）`,
      userMessage: userParts.join('\n\n'),
    };
  }
}
