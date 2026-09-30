// 导出服务 — TXT / Word 导出
//
// 正文按纯文本存储，但历史数据/AI 生成结果里可能混入 HTML，
// 因此导出前统一 stripHtml：TXT 里不会出现标签，Word 里也不会出现 <p><p> 嵌套。
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from '../project/entities/chapter.entity';
import { Volume } from '../project/entities/volume.entity';
import { Book } from '../project/entities/book.entity';
import { stripHtml } from '../../common/utils/text.util';

/** 把纯文本转成 Word 可读的 HTML（按空行切段，段内换行转 <br>） */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = escaped.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) return '<p>暂无内容</p>';
  return paragraphs
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(Chapter)
    private chapterRepository: Repository<Chapter>,
    @InjectRepository(Volume)
    private volumeRepository: Repository<Volume>,
    @InjectRepository(Book)
    private bookRepository: Repository<Book>,
  ) {}

  /** 导出 TXT 格式 */
  async exportTxt(bookId: string, userId: string): Promise<{ filename: string; content: string }> {
    const book = await this.bookRepository.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('书籍不存在');
    if (book.userId !== userId) throw new ForbiddenException('无权操作');

    const volumes = await this.volumeRepository.find({
      where: { bookId },
      order: { volumeNumber: 'ASC' },
    });

    let content = `${book.title}\n`;
    if (book.author) content += `作者: ${book.author}\n`;
    content += `${'='.repeat(50)}\n\n`;

    for (const volume of volumes) {
      content += `第${volume.volumeNumber}卷 ${volume.title}\n`;
      content += `${'-'.repeat(30)}\n\n`;

      const chapters = await this.chapterRepository.find({
        where: { volumeId: volume.id },
        order: { chapterNumber: 'ASC' },
      });

      for (const chapter of chapters) {
        content += `第${chapter.chapterNumber}章 ${chapter.title}\n\n`;
        // 关键：导出的是纯文本，不能把 HTML 标签一起写进 .txt
        content += `${stripHtml(chapter.content) || '(暂无内容)'}\n\n`;
        content += `${'*'.repeat(20)}\n\n`;
      }
    }

    const filename = `${book.title.replace(/[\\/:*?"<>|]/g, '_')}.txt`;
    return { filename, content };
  }

  /** 导出 Word 格式 (简化版 — 返回 HTML 包装) */
  async exportWord(bookId: string, userId: string): Promise<{ filename: string; html: string }> {
    const book = await this.bookRepository.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('书籍不存在');
    if (book.userId !== userId) throw new ForbiddenException('无权操作');

    const volumes = await this.volumeRepository.find({
      where: { bookId },
      order: { volumeNumber: 'ASC' },
    });

    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let html = `<html><head><meta charset="utf-8"><title>${esc(book.title)}</title></head><body>`;
    html += `<h1>${esc(book.title)}</h1>`;
    if (book.author) html += `<p>作者: ${esc(book.author)}</p>`;

    for (const volume of volumes) {
      html += `<h2>第${volume.volumeNumber}卷 ${esc(volume.title)}</h2>`;

      const chapters = await this.chapterRepository.find({
        where: { volumeId: volume.id },
        order: { chapterNumber: 'ASC' },
      });

      for (const chapter of chapters) {
        html += `<h3>第${chapter.chapterNumber}章 ${esc(chapter.title)}</h3>`;
        // 先剥掉可能存在的 HTML，再按纯文本重新排版，避免 <p><p>…</p></p>
        html += textToHtml(stripHtml(chapter.content));
      }
    }

    html += '</body></html>';

    const filename = `${book.title.replace(/[\\/:*?"<>|]/g, '_')}.doc`;
    return { filename, html };
  }
}
