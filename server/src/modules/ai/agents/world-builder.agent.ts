// 世界构建师 Agent — 世界观设定生成
import { BaseAgent } from './base.agent';
import { ModelRouterService } from '../model-router.service';

export class WorldBuilderAgent extends BaseAgent {
  readonly name = 'world-builder';
  readonly description = 'AI世界构建师：生成和补全世界观设定，检测设定矛盾';
  readonly requiredTier = 'plus';

  constructor(modelRouter: ModelRouterService) { super(modelRouter); }

  buildPrompt(input: any) {
    return {
      system: `你是专业世界观设计师，擅长构建严谨、有趣的虚构世界。

世界观类别：
- era: 时代背景（古代/现代/未来/架空）
- society: 社会结构（阶级/制度/家族/门派）
- power_system: 力量体系（魔法/武道/科技/修仙）
- resources: 资源经济（货币/材料/能源）
- culture: 文化习俗（节日/礼仪/语言/艺术）
- geography: 地理环境（大陆/城市/气候/生物）

你的任务是根据已有设定，补全空缺类别，或检测设定矛盾。`,
      user: `已有设定：${input.existingSettings || '无'}
需要补全的类别：${input.missingCategory || 'all'}
故事类型：${input.genre || '通用'}

输出JSON：
{"category":"...","title":"...","content":"详细的世界观设定内容"}`,
    };
  }

  parseResult(content: string) {
    return this.extractJSON(content) || { raw: content };
  }
}
