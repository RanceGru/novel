// 导出控制器
import { Controller, Post, Param, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportService } from './export.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('导出')
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post('txt/:bookId')
  @ApiOperation({ summary: '导出书籍为 TXT' })
  async exportTxt(
    @Param('bookId') bookId: string,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    const { filename, content } = await this.exportService.exportTxt(bookId, user.id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.status(HttpStatus.OK).send(content);
  }

  @Post('word/:bookId')
  @ApiOperation({ summary: '导出书籍为 Word 文档' })
  async exportWord(
    @Param('bookId') bookId: string,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    const { filename, html } = await this.exportService.exportWord(bookId, user.id);
    res.setHeader('Content-Type', 'application/msword; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.status(HttpStatus.OK).send(html);
  }
}
