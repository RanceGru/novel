// 未保存文本编辑器 — 「功能区 → 新建文本」打开的空白文本
//
// 它还没有归属位置，所以面包屑显示「未保存文本」；点保存时弹窗让用户选择
// 落到哪里（分卷下的新章节 / 分卷外章节 / 细纲 / 角色子项 / 世界观条目）。
import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { useEditorStore, DocKind } from '../../stores/editor.store';
import { useProjectStore } from '../../stores/project.store';
import { apiClient } from '../../services/api.service';
import EditorBreadcrumb from './EditorBreadcrumb';
import SaveDraftDialog from './SaveDraftDialog';

export default function DraftEditor() {
  const { draftText, setDraftText, clearDraft, selectDoc } = useEditorStore();
  const currentBook = useProjectStore((s) => s.currentBook);
  const books = useProjectStore((s) => s.books);
  const [dialogOpen, setDialogOpen] = useState(false);

  const content = draftText ?? '';

  /**
   * 草稿要落到哪本书里 —— 现在由弹窗自己列出所有作品让用户选，
   * 这里只需要判断「有没有作品可存」。
   */

  /**
   * 打开刚保存出来的章节（走正常正文编辑器，自动保存等逻辑与目录选章一致）。
   *
   * 注意：这里直接用手上的内容填状态，不去异步拉取。
   * 因为 setCurrentChapter 会先把内容清空，若此时自动保存被触发，就会用空内容
   * 覆盖刚写进去的正文（实测踩到过，草稿内容会丢失）。
   */
  const openChapter = (bookId: string, volumeId: string, chapterId: string, chapterTitle: string,
    chapterNumber: number, volumeTitle?: string, volumeNumber?: number) => {
    const st = useEditorStore.getState();
    const bookTitle = currentBook?.title || books.find((b) => b.id === bookId)?.title;
    st.setCurrentChapter(bookId, volumeId, chapterId);
    st.setContent(content);
    st.setChapterOutline('');
    st.setInstruction('');
    st.setCurrentPath([
      ...(bookTitle ? [bookTitle] : []), '目录',
      ...(volumeTitle && volumeTitle !== '默认' ? [`第${volumeNumber}卷 ${volumeTitle}`] : []),
      `第${chapterNumber}章 ${chapterTitle}`,
    ]);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-primary bg-bg-secondary text-xs">
        <EditorBreadcrumb />
        <span className="ml-auto flex items-center gap-3 shrink-0">
          <span data-role="draft-count" className="text-text-tertiary">
            {content.replace(/\s/g, '').length} 字
          </span>
          <button data-role="draft-save" onClick={() => setDialogOpen(true)}
            className="px-2 py-0.5 text-brand-primary hover:bg-bg-hover rounded"
            title="保存到指定位置">
            <Save size={12} className="inline" /> 保存
          </button>
          <button onClick={clearDraft} className="px-1.5 py-0.5 text-text-tertiary hover:text-text-primary rounded hover:bg-bg-hover"
            title="关闭（不保存）">
            <X size={13} />
          </button>
        </span>
      </div>

      <div className="flex-1 overflow-hidden">
        <textarea
          data-role="draft-content"
          value={content}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="在这里写点什么… 保存时再选择放到书里的哪个位置（章节、细纲、角色子项、世界观都行）"
          className="chapter-editor w-full h-full p-6 text-sm leading-relaxed resize-none focus:outline-none font-sans"
        />
      </div>

      <div className="px-3 py-1 text-[11px] text-text-tertiary border-t border-border-primary flex items-center gap-3">
        <span>未保存文本</span>
        <span className="ml-auto">点「保存」选择存放位置</span>
      </div>

      {/* 保存位置改由弹窗内自己选：先列作品，再选目录/相关往下钻，故不再传 bookId */}
      {books.length ? (
        <SaveDraftDialog
          open={dialogOpen}
          content={content}
          onClose={() => setDialogOpen(false)}
          onSaved={async (info) => {
            setDialogOpen(false);
            clearDraft();
            if (info.volumeId) {
              // 保存成了章节：直接打开该章节（走正常正文编辑器，自动保存等逻辑一致）
              // bookId 由弹窗回传（作品是在弹窗里选的）
              openChapter(info.bookId, info.volumeId, info.id, info.title,
                info.chapterNumber || 1, info.volumeTitle, info.volumeNumber || 0);
            } else {
              // 保存成了条目（细纲/角色子项/世界观）：切到条目编辑器
              selectDoc({
                kind: info.docKind as DocKind, id: info.id, title: info.title,
                content, editableTitle: false,
              });
            }
          }}
        />
      ) : (
        // 一本书都没有时给明确提示，而不是让按钮点了没反应
        dialogOpen && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setDialogOpen(false)}>
            <div className="bg-bg-primary rounded-lg shadow-xl px-5 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2">还没有作品，无法保存。</div>
              <div className="text-xs text-text-tertiary mb-3">请先在左侧「新建作品」创建一本书。</div>
              <button onClick={() => setDialogOpen(false)}
                className="px-3 py-1 text-xs bg-brand-primary text-brand-text rounded">知道了</button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
