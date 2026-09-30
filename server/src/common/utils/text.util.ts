// 正文文本工具
//
// 正文按纯文本存储（段落用空行分隔），但历史数据与 AI 生成结果里可能混入 HTML，
// 因此凡是「统计字数 / 拼接提示词 / 导出纯文本」的地方都走这里统一处理，
// 避免把标签当正文（之前字数统计直接把 HTML 标签也算进去了）。

/** 去掉 HTML 标签，得到纯文本 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    // 段落/换行类标签先转成换行，避免相邻段落被粘成一行
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|blockquote)\s*>/gi, '\n')
    // 去掉其余标签
    .replace(/<[^>]*>/g, '')
    // 常见实体还原
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // 折叠过多空行（HTML 拆出来的空段）
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 正文字数：按「去空白后的字符数」计。
 * 中文场景下这比按词数更符合直觉，也是网文平台的通用口径。
 */
export function countWords(input: string | null | undefined): number {
  const text = stripHtml(input);
  return text.replace(/\s/g, '').length;
}
