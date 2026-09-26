// 人设师 Agent — AI角色创建
import { BaseAgent, MemoryContext } from './base.agent';
import { ModelRouterService } from '../model-router.service';

export class CharacterDesignerAgent extends BaseAgent {
  readonly name = 'character-designer';
  readonly description = 'AI人设师：根据世界观和故事需求，自动生成完整角色档案';
  readonly requiredTier = 'basic';

  constructor(modelRouter: ModelRouterService) { super(modelRouter); }

  buildPrompt(input: any, memoryContext?: MemoryContext) {
    return {
      system: `你是专业小说人设师。根据世界观设定和故事需求，设计立体、有深度的角色。

角色档案应包含：
1. 基本信息：姓名、别名、年龄、身份
2. 外貌特征：身高体型、标志性特征、着装风格
3. 性格描述：核心性格、优缺点、行为模式
4. 背景故事：出身、关键经历、内心创伤
5. 能力特长：战斗/魔法/智力/社交等
6. 目标动机：短期目标、终极目标、内心渴望
7. 角色弧线：从开始到结束的成长轨迹
8. 人际关系：与已有角色的关系网`,
      user: `世界观设定：${input.worldSettings || '通用'}
故事需求：${input.storyNeeds || '需要设计角色'}
已有角色：${input.existingCharacters || '无'}
角色类型：${input.category || 'supporting'}

请输出完整角色档案（JSON格式）：
{"name":"...","alias":"...","category":"...","background":"...","personality":"...","abilities":"...","appearance":"...","goals":"...","arc_summary":"...","relations":[{"target":"...","type":"...","description":"..."}]}`,
    };
  }

  parseResult(content: string) {
    return this.extractJSON(content) || { raw: content };
  }
}
