// 质检员 Agent — AI生成内容审查
import { BaseAgent } from './base.agent';
import { ModelRouterService } from '../model-router.service';

export class QualityInspectorAgent extends BaseAgent {
  readonly name = 'quality-inspector';
  readonly description = 'AI质检员：审查章节质量，检测剧情漏洞和角色OOC';
  readonly requiredTier = 'basic';

  constructor(modelRouter: ModelRouterService) { super(modelRouter); }

  buildPrompt(input: any) {
    return {
      system: `你是专业小说编辑。请审查以下章节内容，从多个维度评估质量。

审查维度（每项1-10分）：
1. 情节连贯：剧情逻辑是否自洽
2. 角色一致：角色行为是否符合人设
3. 节奏控制：详略是否得当
4. 文笔质量：语言是否流畅自然
5. 对话自然：对话是否贴合角色
6. 场景描写：环境渲染是否到位
7. 情感表达：情感过渡是否真实

发现任何问题，请标注：
- plot_hole: 剧情漏洞
- character_inconsistency: 角色OOC
- setting_conflict: 设定矛盾
- pacing_issue: 节奏问题
- grammar: 语法问题`,
      user: `章纲：${input.chapterOutline || ''}
角色设定：${input.characters || ''}
正文（前3000字）：${(input.chapterContent || '').substring(0, 3000)}

请输出审查结果（JSON）：
{"overall_score":7.5,"dimensions":{"plot":8,"character":7,"rhythm":6,"writing":8,"dialogue":7,"scene":7,"emotion":8},"issues":[{"type":"...","description":"...","severity":"medium","suggestion":"..."}]}`,
    };
  }

  parseResult(content: string) {
    return this.extractJSON(content) || { overall_score: 0, dimensions: {}, issues: [] };
  }
}
