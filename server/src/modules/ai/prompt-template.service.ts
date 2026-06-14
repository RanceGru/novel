// Prompt 模板引擎 — 基础版本
import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptTemplateService {
  /** 组装章节生成 Prompt */
  buildChapterGenerationPrompt(params: {
    chapterOutline: string;
    instruction: string;
    targetWordCount: number;
    contextSummary?: string;
  }): { systemPrompt: string; userMessage: string } {
    const systemPrompt = `你是一位专业的网文小说作家。你的任务是严格按照章纲和写作指令，生成高质量的章节正文。

## 写作要求：
1. 严格按照章纲的情节结构展开
2. 遵循写作指令中的风格要求
3. 语言流畅自然，避免AI说教感
4. 合理分配篇幅，重点情节详细，过渡情节简洁
5. 目标字数约 ${params.targetWordCount} 字
6. 只输出正文内容，不要添加解释或标记`;

    const userMessageParts: string[] = [];

    if (params.contextSummary) {
      userMessageParts.push(`## 前文摘要\n${params.contextSummary}`);
    }

    userMessageParts.push(`## 本章章纲\n${params.chapterOutline}`);

    if (params.instruction) {
      userMessageParts.push(`## 写作指令\n${params.instruction}`);
    }

    userMessageParts.push(`## 任务\n请根据以上章纲和指令，生成本章节的完整正文。目标字数：${params.targetWordCount} 字。`);

    return {
      systemPrompt,
      userMessage: userMessageParts.join('\n\n'),
    };
  }

  /** 组装章纲生成 Prompt */
  buildChapterOutlinePrompt(params: {
    context: string;
    instruction?: string;
  }): { systemPrompt: string; userMessage: string } {
    return {
      systemPrompt: `你是一位专业的小说大纲策划师。请根据提供的上下文信息，生成详细的章纲。

章纲应包含：
1. 本章核心情节（2-3 个关键场景）
2. 主要人物的行为与对话目标
3. 情感基调与节奏控制
4. 与前后章节的衔接要点`,
      userMessage: `## 上下文信息\n${params.context}\n\n${params.instruction ? `## 额外要求\n${params.instruction}\n\n` : ''}## 任务\n请生成本章的详细章纲。`,
    };
  }
}
