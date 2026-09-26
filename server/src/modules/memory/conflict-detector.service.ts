// 冲突检测服务
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEvent } from './entities/memory-event.entity';
import { Foreshadow } from './entities/foreshadow.entity';
import { CharacterState } from './entities/character-state.entity';
import { Chapter } from '../project/entities/chapter.entity';

export interface Conflict {
  type: 'foreshadow' | 'character_state' | 'setting' | 'timeline';
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestedResolution?: string;
}

@Injectable()
export class ConflictDetectorService {
  private readonly logger = new Logger(ConflictDetectorService.name);

  constructor(
    @InjectRepository(MemoryEvent) private eventRepo: Repository<MemoryEvent>,
    @InjectRepository(Foreshadow) private foreshadowRepo: Repository<Foreshadow>,
    @InjectRepository(CharacterState) private stateRepo: Repository<CharacterState>,
    @InjectRepository(Chapter) private chapterRepo: Repository<Chapter>,
  ) {}

  /** 检测章节内容与记忆系统的冲突 */
  async detect(chapterId: string, bookId: string): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    const chapter = await this.chapterRepo.findOne({ where: { id: chapterId } });
    if (!chapter?.content) return conflicts;

    // 1. 检测未回收的伏笔是否被遗漏
    const oldForeshadows = await this.foreshadowRepo.find({
      where: { bookId, status: 'active' },
    });
    for (const f of oldForeshadows) {
      const created = new Date(f.createdAt);
      const daysSince = (Date.now() - created.getTime()) / (1000 * 86400);
      if (daysSince > 90) { // 超过90天未回收的高优先级伏笔
        conflicts.push({
          type: 'foreshadow',
          description: `伏笔"${f.title}"已超过90天未回收`,
          severity: f.type === 'major' ? 'high' : 'medium',
          suggestedResolution: '建议在最近章节中回收此伏笔，或标记为废弃',
        });
      }
    }

    // 2. 简单角色状态一致性检查
    const recentStates = await this.stateRepo
      .createQueryBuilder('cs')
      .orderBy('cs.chapterTimestamp', 'DESC')
      .take(10)
      .getMany();

    const stateChars = new Set(recentStates.map(s => s.characterId));
    for (const charId of stateChars) {
      const states = recentStates.filter(s => s.characterId === charId);
      if (states.length >= 3) {
        // 检查是否有连续相同的状态（停滞）
        const recentThree = states.slice(0, 3);
        const allSameLocation = recentThree.every(s => s.location === recentThree[0].location);
        if (allSameLocation && recentThree[0].location) {
          conflicts.push({
            type: 'character_state',
            description: `角色已连续3章停留在"${recentThree[0].location}"，状态可能停滞`,
            severity: 'low',
            suggestedResolution: '考虑移动角色位置或增加场景变化',
          });
        }
      }
    }

    return conflicts;
  }
}
