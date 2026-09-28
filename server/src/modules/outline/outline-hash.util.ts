// 纲内容指纹 — 用于判断「章纲是否在生成正文之后被改动过」
//
// 语义：章节保存的是生成那一刻的章纲快照（chapters.chapter_outline）与其指纹
// （chapters.outline_hash）。读章节时用纲树当前的章纲内容重新计算指纹，
// 与保存值比对：不一致即说明章纲已改动，前端据此提示，但不会自动改写正文。
import { createHash } from 'crypto';

/**
 * 计算纲内容的指纹。
 * 统一做换行归一化，避免仅因 CRLF/LF 差异误报"已改动"。
 */
export function outlineHash(content: string | null | undefined): string {
  const normalized = (content ?? '').replace(/\r\n/g, '\n').trim();
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
