// 记忆提取服务 — LLM驱动的事件/角色状态/伏笔/设定提取
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEvent } from './entities/memory-event.entity';
import { Foreshadow } from './entities/foreshadow.entity';
import { CharacterState } from './entities/character-state.entity';
import { SettingPatch } from './entities/setting-patch.entity';
import { StyleAnchor } from './entities/style-anchor.entity';
import { SubplotThread } from './entities/subplot-thread.entity';
import { Chapter } from '../project/entities/chapter.entity';
import { Character } from '../character/entities/character.entity';
import { WorldSetting } from '../worldbuilding/entities/world-setting.entity';
import { EmbeddingService } from './embedding.service';
import { SUBSCRIPTION_PLANS } from '@novel/shared';

@Injectable()
export class MemoryExtractionService {
  private readonly logger = new Logger(MemoryExtractionService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.deepseek.com';

  constructor(
    @InjectRepository(MemoryEvent) private eventRepo: Repository<MemoryEvent>,
    @InjectRepository(Foreshadow) private foreshadowRepo: Repository<Foreshadow>,
    @InjectRepository(CharacterState) private stateRepo: Repository<CharacterState>,
    @InjectRepository(SettingPatch) private patchRepo: Repository<SettingPatch>,
    @InjectRepository(StyleAnchor) private anchorRepo: Repository<StyleAnchor>,
    @InjectRepository(SubplotThread) private subplotRepo: Repository<SubplotThread>,
    @InjectRepository(Chapter) private chapterRepo: Repository<Chapter>,
    @InjectRepository(Character) private charRepo: Repository<Character>,
    @InjectRepository(WorldSetting) private wsRepo: Repository<WorldSetting>,
    private embeddingService: EmbeddingService,
  ) {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
  }

  /** 主提取入口 */
  async extract(chapterId: string, bookId: string, userId: string, plan: string = 'free') {
    const chapter = await this.chapterRepo.findOne({ where: { id: chapterId } });
    if (!chapter || !chapter.content) {
      this.logger.warn('章节为空，跳过提取');
      return { events: 0, states: 0, foreshadows: 0, patches: 0 };
    }

    const content = chapter.content.substring(0, 8000); // 限制长度控制成本
    const planConfig = SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.free;

    // 并行提取（基础）
    const [eventCount] = await Promise.all([
      this.extractEvents(content, bookId, chapterId),
    ]);

    // 角色状态（仅 Basic+ 套餐）
    let stateCount = 0;
    if (planConfig.aiDehumanizeReview) {
      stateCount = await this.extractCharacterStates(content, bookId, chapterId, chapter.chapterNumber);
    }

    // 伏笔检测
    let foreshadows = 0;
    try {
      foreshadows = await this.scanForeshadows(content, bookId, chapterId);
    } catch (e: any) {
      this.logger.warn('伏笔检测失败: ' + e.message);
    }

    // 设定变化检测
    let patchCount = 0;
    try {
      patchCount = await this.detectSettingChanges(content, bookId, chapterId);
    } catch (e: any) {
      this.logger.warn('设定检测失败: ' + e.message);
    }

    // 物品/货币追踪
    let itemCount = 0;
    try {
      itemCount = await this.extractItems(content, bookId, chapterId);
    } catch (e: any) {
      this.logger.warn('物品追踪失败: ' + e.message);
    }

    // 角色交互记录
    let interactionCount = 0;
    try {
      interactionCount = await this.extractInteractions(content, bookId, chapterId);
    } catch (e: any) {
      this.logger.warn('交互记录失败: ' + e.message);
    }

    // 风格锚点提取
    let styleCount = 0;
    try {
      styleCount = await this.extractStyleAnchor(content, bookId, chapterId);
    } catch (e: any) {
      this.logger.warn('风格锚点提取失败: ' + e.message);
    }

    // 主支线进度更新
    try {
      await this.updatePlotProgress(bookId, chapterId, chapter.chapterNumber);
    } catch (e: any) {
      this.logger.warn('进度更新失败: ' + e.message);
    }

    // 生成嵌入向量
    await this.generateEmbeddings(bookId, chapterId);

    this.logger.log(`提取完成: ${eventCount}事件 ${stateCount}状态 ${foreshadows}伏笔 ${patchCount}补丁 ${itemCount}物品 ${interactionCount}交互 ${styleCount}风格`);

    return { events: eventCount, states: stateCount, foreshadows, patches: patchCount, items: itemCount, interactions: interactionCount, styles: styleCount };
  }

  /** 提取关键事件 */
  private async extractEvents(content: string, bookId: string, chapterId: string): Promise<number> {
    const prompt = `分析以下小说章节，提取3-5个关键事件。每个事件包含：
- title: 事件标题（10字内）
- summary: 事件摘要（50字内）
- event_type: 类型（conflict/revelation/turning_point/character_growth/relationship）
- importance: 重要度（1-10，默认5）

章节内容：
${content}

请用JSON数组格式回复：[{"title":"...","summary":"...","event_type":"...","importance":5}]`;

    const events = await this.callLLM(prompt);
    if (!Array.isArray(events)) return 0;

    const saved = events.map(e =>
      this.eventRepo.create({
        bookId, chapterId,
        title: e.title || '未命名事件',
        summary: e.summary || '',
        eventType: e.event_type || 'general',
        importance: e.importance || 5,
      }),
    );
    const result = await this.eventRepo.save(saved);
    return result.length;
  }

  /** 提取角色状态快照 */
  private async extractCharacterStates(content: string, bookId: string, chapterId: string, chapterNumber: number): Promise<number> {
    const characters = await this.charRepo.find({ where: { bookId } });
    if (characters.length === 0) return 0;

    const charList = characters.map(c => `${c.name}(${c.category})`).join('、');
    const prompt = `分析以下章节中各个角色的状态变化。角色列表：${charList}

章节内容：
${content}

请用JSON格式回复，为每个在章节中出现的角色提供状态：
{"characters":[{"name":"角色名","physical_state":"身体状态","mental_state":"心理状态","emotional_state":"情感状态","location":"位置","possessions":"持有物品"}]}`;

    const result = await this.callLLM(prompt);
    if (!result?.characters) return 0;

    const states: CharacterState[] = [];
    for (const item of result.characters) {
      const char = characters.find(c => c.name === item.name);
      if (char) {
        states.push(this.stateRepo.create({
          characterId: char.id, chapterId,
          physicalState: item.physical_state,
          mentalState: item.mental_state,
          emotionalState: item.emotional_state,
          location: item.location,
          possessions: item.possessions,
          chapterTimestamp: chapterNumber,
        }));
      }
    }
    const saved = await this.stateRepo.save(states);
    return saved.length;
  }

  /** 伏笔扫描 */
  private async scanForeshadows(content: string, bookId: string, chapterId: string): Promise<number> {
    const activeForeshadows = await this.foreshadowRepo.find({
      where: { bookId, status: 'active' },
      take: 20,
    });
    const activeList = activeForeshadows.map(f => `[${f.id.substring(0,8)}] ${f.title}`).join('\n');

    const prompt = `分析以下章节，检测：
1. 是否埋下了新的伏笔（new_foreshadows）
2. 是否回收/推动了以下已有伏笔（resolved_foreshadows）

已有伏笔列表：${activeList || '（暂无）'}

章节内容：
${content}

请用JSON回复：{"new_foreshadows":[{"title":"...","description":"...","type":"major/minor"}],"resolved":[{"id":"...","progress":"..."}]}`;

    const result = await this.callLLM(prompt);
    let count = 0;

    // 新伏笔
    if (result?.new_foreshadows) {
      for (const f of result.new_foreshadows) {
        await this.foreshadowRepo.save(this.foreshadowRepo.create({
          bookId, plantedChapterId: chapterId,
          title: f.title, description: f.description,
          type: f.type || 'minor', status: 'active',
        }));
        count++;
      }
    }

    // 回收伏笔
    if (result?.resolved) {
      for (const r of result.resolved) {
        if (r.id) {
          const foreshadow = activeForeshadows.find(f => f.id.startsWith(r.id));
          if (foreshadow) {
            foreshadow.progressNotes = r.progress || '';
            if (r.resolved) {
              foreshadow.status = 'resolved';
              foreshadow.resolvedChapterId = chapterId;
              foreshadow.resolvedAt = new Date();
            }
            await this.foreshadowRepo.save(foreshadow);
            count++;
          }
        }
      }
    }

    return count;
  }

  /** 世界观设定变化检测 */
  private async detectSettingChanges(content: string, bookId: string, chapterId: string): Promise<number> {
    const settings = await this.wsRepo.find({ where: { bookId } });
    const settingList = settings.map(s => `[${s.category}] ${s.title}: ${(s.content||'').substring(0,50)}`).join('\n');

    const prompt = `分析章节中是否对世界观设定有新增/修改/废弃。当前设定：${settingList || '无'}

章节内容：
${content}

用JSON回复：{"patches":[{"world_setting_title":"...","patch_type":"addition/modification/deprecation","patch_content":"..."}]}`;

    const result = await this.callLLM(prompt);
    if (!result?.patches) return 0;

    const patches = result.patches.map((p: any) => {
      const setting = settings.find(s => s.title === p.world_setting_title);
      return this.patchRepo.create({
        bookId, chapterId,
        worldSettingId: setting?.id || null,
        patchType: p.patch_type || 'addition',
        patchContent: p.patch_content || '',
      });
    });
    const saved = await this.patchRepo.save(patches);
    return saved.length;
  }

  /** 物品/货币追踪 */
  private async extractItems(content: string, bookId: string, chapterId: string): Promise<number> {
    const characters = await this.charRepo.find({ where: { bookId } });
    if (characters.length === 0) return 0;

    const charList = characters.map(c => c.name).join('、');
    const prompt = `分析以下章节中角色持有的物品、法宝、货币、资源的变化。

角色列表：${charList}

章节内容：
${content}

请用JSON数组回复物品变更：
[{"character":"角色名","item":"物品名","change":"获得/失去/消耗/使用","quantity":"数量变化","notes":"备注"}]`;

    const items = await this.callLLM(prompt);
    if (!Array.isArray(items)) return 0;

    // 将物品变更记录到角色状态更新中
    let count = 0;
    for (const item of items) {
      if (!item.character || !item.item) continue;
      const char = characters.find(c => c.name === item.character);
      if (char) {
        // 更新或创建角色状态，追加持有物品信息
        const existing = await this.stateRepo.findOne({
          where: { characterId: char.id, chapterId },
        });
        if (existing) {
          const newPossession = `${item.change}:${item.item}${item.quantity ? `(${item.quantity})` : ''}`;
          existing.possessions = existing.possessions
            ? `${existing.possessions}; ${newPossession}`
            : newPossession;
          await this.stateRepo.save(existing);
          count++;
        }
      }
    }
    return count;
  }

  /** 角色交互记录 */
  private async extractInteractions(content: string, bookId: string, chapterId: string): Promise<number> {
    const characters = await this.charRepo.find({ where: { bookId } });
    if (characters.length < 2) return 0;

    const charList = characters.map(c => c.name).join('、');
    const prompt = `分析以下章节中角色之间的交互事件。每个交互包含参与角色、交互类型和简要描述。

角色列表：${charList}

章节内容（前4000字）：
${content.substring(0, 4000)}

请用JSON数组回复：
[{"characters":["角色A","角色B"],"type":"对话/战斗/合作/冲突/情感交流","description":"交互描述（30字内）","intensity":1-10}]`;

    const interactions = await this.callLLM(prompt);
    if (!Array.isArray(interactions)) return 0;

    // 将交互记录存储为记忆事件（类型为 interaction）
    const events = interactions.map(i =>
      this.eventRepo.create({
        bookId, chapterId,
        title: `${(i.characters || []).join('&')}: ${i.type || '交互'}`,
        summary: i.description || '',
        eventType: 'interaction',
        importance: i.intensity || 5,
      }),
    );
    const saved = await this.eventRepo.save(events);
    return saved.length;
  }

  /** 风格锚点提取 */
  private async extractStyleAnchor(content: string, bookId: string, chapterId: string): Promise<number> {
    const prompt = `分析以下小说章节的写作风格特征。

章节内容（前3000字）：
${content.substring(0, 3000)}

请用JSON回复风格参数：
{
  "style_features": {
    "avg_sentence_length": "短/中/长",
    "dialogue_ratio": "0.0-1.0（对话占全文比例估算）",
    "description_density": "低/中/高",
    "perspective": "第一人称/第三人称限知/第三人称全知",
    "tense": "过去式/现在式",
    "tone": "严肃/轻松/热血/悲情/幽默/黑暗"
  },
  "sample_text": "最具代表性的段落（100字内）"
}`;

    const result = await this.callLLM(prompt);
    if (!result) return 0;

    const anchor = this.anchorRepo.create({
      bookId, chapterId,
      styleFeatures: result.style_features || {},
      sampleText: result.sample_text || content.substring(0, 100),
    });
    await this.anchorRepo.save(anchor);
    return 1;
  }

  /** 主支线进度更新 */
  private async updatePlotProgress(bookId: string, chapterId: string, chapterNumber: number): Promise<void> {
    // 获取所有活跃的子线线程
    const subplots = await this.subplotRepo.find({
      where: { bookId, status: 'active' },
    });

    if (subplots.length === 0) return;

    // 获取章节内容用于分析
    const chapter = await this.chapterRepo.findOne({ where: { id: chapterId } });
    if (!chapter?.content) return;

    const subplotList = subplots.map(s => `[${s.id.substring(0, 8)}] ${s.title}: ${(s.description || '').substring(0, 50)}`).join('\n');
    const prompt = `分析以下章节内容，判断它推进了哪些子线/支线剧情。

活跃子线列表：
${subplotList}

章节内容（前3000字）：
${chapter.content.substring(0, 3000)}

请用JSON回复：
{"updates":[{"subplot_id_prefix":"子线ID前8位","progress":"推进描述","status":"仍活跃/已回收"}]}`;

    const result = await this.callLLM(prompt);
    if (!result?.updates) return;

    for (const update of result.updates) {
      if (!update.subplot_id_prefix) continue;
      const subplot = subplots.find(s => s.id.startsWith(update.subplot_id_prefix));
      if (subplot) {
        if (update.status === '已回收') {
          subplot.status = 'resolved';
          subplot.endedChapterId = chapterId;
        }
        subplot.description = subplot.description
          ? `${subplot.description}\n第${chapterNumber}章: ${update.progress}`
          : `第${chapterNumber}章: ${update.progress}`;
        await this.subplotRepo.save(subplot);
      }
    }
  }

  /** 为提取结果生成嵌入向量 */
  async generateEmbeddings(bookId: string, chapterId: string) {
    // 获取未向量化的事件
    const events = await this.eventRepo.find({
      where: { bookId, chapterId },
    });

    const unembedded = events.filter(e => !e.embedding);
    if (unembedded.length > 0) {
      const texts = unembedded.map(e => e.title + ' ' + (e.summary || ''));
      const embeddings = await this.embeddingService.embedBatch(texts);
      for (let i = 0; i < unembedded.length; i++) {
        unembedded[i].embedding = embeddings[i];
        await this.eventRepo.save(unembedded[i]);
      }
    }
  }

  /** 通用 LLM 调用 */
  private async callLLM(prompt: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是小说分析专家。请严格按照JSON格式回复，不要添加额外说明。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) throw new Error(`LLM调用失败: ${response.status}`);

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content || '';

      // 提取 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return null;
    } catch (error: any) {
      this.logger.error(`LLM调用错误: ${error.message}`);
      return null;
    }
  }
}
