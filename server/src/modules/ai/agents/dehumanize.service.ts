// AI去味审查服务 — AI味检测 + 人性化润色
import { Injectable, Logger } from '@nestjs/common';
import { ModelRouterService } from '../model-router.service';

export interface DehumanizeResult {
  overallScore: number;
  dimensionScores: {
    repetition: number; transition: number; emotion: number;
    dialogue: number; variety: number; vocabulary: number; creativity: number;
  };
  flaggedSegments: Array<{
    text: string; issue: string; suggestion: string;
    position: { start: number; end: number };
    severity: 'low' | 'medium' | 'high';
  }>;
  rewrittenText: string;
  diffWithOriginal: string;
}

@Injectable()
export class DehumanizeService {
  private readonly logger = new Logger(DehumanizeService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.deepseek.com';

  constructor(private modelRouter: ModelRouterService) {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
  }

  /** 主入口：检测+润色 */
  async review(content: string, userPlan: string): Promise<DehumanizeResult> {
    // 权限检查
    if (!['basic', 'plus', 'pro'].includes(userPlan)) {
      throw new Error('AI去味审查需要 Basic 及以上套餐');
    }

    // 只检测前3000字（控制成本）
    const sample = content.substring(0, 3000);
    const detection = await this.detectAIFlavor(sample);
    const rewritten = await this.rewrite(sample, detection.flaggedSegments);

    // 生成差异对比
    const diff = this.generateDiff(sample, rewritten);

    return {
      overallScore: detection.overallScore,
      dimensionScores: detection.dimensionScores,
      flaggedSegments: detection.flaggedSegments,
      rewrittenText: rewritten,
      diffWithOriginal: diff,
    };
  }

  /** AI味检测 */
  private async detectAIFlavor(text: string): Promise<{
    overallScore: number;
    dimensionScores: any;
    flaggedSegments: any[];
  }> {
    const prompt = `你是AI文本鉴定专家。分析以下文本的"AI机器味"程度。

7个检测维度（1-10分，分数越高越自然）：
1. repetition: 是否有重复句式（"不仅...而且..."、"在...的过程中"等）
2. transition: 过渡词是否格式化（"首先/其次/最后"、"总而言之"等）
3. emotion: 情感描写是否有起伏（还是平铺直叙）
4. dialogue: 角色对话是否自然（还是模板化）
5. variety: 句式是否有变化（长短句交替）
6. vocabulary: 词汇是否丰富（还是单调重复）
7. creativity: 创意表达（还是说教感/总结感强）

标注出具体的AI味片段并给出修改建议。

文本：
${text}

输出JSON：
{"overall_score":6.5,"dimension_scores":{"repetition":7,"transition":5,"emotion":6,"dialogue":7,"variety":6,"vocabulary":7,"creativity":5},"flagged_segments":[{"text":"...","issue":"...","suggestion":"...","severity":"low/medium/high"}]}`;

    const route = this.modelRouter.routeByTier('basic');
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是专业文本鉴定专家。只输出JSON，不添加额外说明。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3, max_tokens: 4096,
      }),
    });

    if (!response.ok) throw new Error(`去味检测失败: ${response.status}`);

    const data = await response.json() as any;
    const raw = data.choices?.[0]?.message?.content || '';
    const json = this.extractJSON(raw);

    return {
      overallScore: json?.overall_score || 5,
      dimensionScores: {
        repetition: json?.dimension_scores?.repetition || 5,
        transition: json?.dimension_scores?.transition || 5,
        emotion: json?.dimension_scores?.emotion || 5,
        dialogue: json?.dimension_scores?.dialogue || 5,
        variety: json?.dimension_scores?.variety || 5,
        vocabulary: json?.dimension_scores?.vocabulary || 5,
        creativity: json?.dimension_scores?.creativity || 5,
      },
      flaggedSegments: this.locateSegments(text, json?.flagged_segments || []),
    };
  }

  /** 人性化润色 */
  private async rewrite(text: string, flaggedSegments: any[]): Promise<string> {
    const issues = flaggedSegments.map(f => `问题: ${f.issue}, 建议: ${f.suggestion}`).join('\n');

    const prompt = `请对以下AI生成文本进行"人性化润色"，消除机器味。要求：
1. 替换重复句式和格式化过渡词
2. 增加情感起伏和对话自然度
3. 多样化句式和丰富词汇
4. 消除说教感和总结式结尾
5. 保留原意和故事走向

具体问题：
${issues}

原文：
${text}

请直接输出润色后的完整文本，不添加解释。`;

    const route = this.modelRouter.routeByTier('basic');
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是专业小说润色师。只输出润色后的文本。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6, max_tokens: 4096,
      }),
    });

    if (!response.ok) return text; // 失败时返回原文
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || text;
  }

  /** 简单差异标记 */
  private generateDiff(original: string, rewritten: string): string {
    let diff = '';
    const origLines = original.split('\n');
    const newLines = rewritten.split('\n');
    const maxLen = Math.max(origLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      const orig = origLines[i] || '';
      const news = newLines[i] || '';
      if (orig !== news) {
        diff += `- ${orig.substring(0, 80)}\n+ ${news.substring(0, 80)}\n`;
      }
    }
    return diff || '无显著差异';
  }

  /** 在原文中定位标记片段 */
  private locateSegments(original: string, segments: Array<{ text: string; issue: string; suggestion: string; severity: string }>) {
    return segments.map(f => {
      const idx = original.indexOf(f.text);
      return {
        ...f,
        position: idx >= 0 ? { start: idx, end: idx + f.text.length } : { start: 0, end: 0 },
      };
    });
  }

  private extractJSON(text: string): any {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch {} }
    return null;
  }
}
