// 文风模拟师 Agent — 分析文风参数
import { BaseAgent } from './base.agent';
import { ModelRouterService } from '../model-router.service';

export class StyleMimicAgent extends BaseAgent {
  readonly name = 'style-mimic';
  readonly description = 'AI文风模拟师：分析文本风格，提取写作参数';
  readonly requiredTier = 'pro';

  constructor(modelRouter: ModelRouterService) { super(modelRouter); }

  buildPrompt(input: any) {
    return {
      system: `你是专业文风分析师。请分析提供的文本样本，提取以下风格参数：

1. 语调(tone): formal/casual/humorous/serious/dramatic
2. 节奏(pace): fast/moderate/slow
3. 视角(perspective): first_person/third_person_limited/third_person_omniscient
4. 语言风格: 用词偏好、句式特点、修辞习惯
5. 对话风格: 直接/间接、口语化程度
6. 描写密度: 细节描写的丰富程度(1-10)
7. 段落长度: 偏好长段落还是短段落`,
      user: `请分析以下文风样本的前2000字：
${(input.sampleText || '').substring(0, 2000)}

输出JSON：
{"tone":"...","pace":"...","perspective":"...","languageStyle":"...","dialogueStyle":"...","descriptionDensity":5,"paragraphPreference":"...","customInstructions":"用于AI生成的写作指令"}`,
    };
  }

  parseResult(content: string) {
    return this.extractJSON(content) || { tone: 'casual', pace: 'moderate', perspective: 'third_person_limited' };
  }
}
