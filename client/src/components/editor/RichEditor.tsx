// 正文编辑器 — 纯文本
//
// 为什么用纯文本而不是富文本（Tiptap）：
//   · 小说正文本质是线性文本，「段落 = 空行分隔」已经足够；加粗/标题这些在
//     网文平台粘贴时会被剥掉，对创作没有实际价值
//   · 富文本会把内容存成 HTML，导致字数统计把标签算进去、txt 导出带标签、
//     doc 导出出现 <p><p> 嵌套、版本 diff 变脏、后续 embedding 要做剥离
//   · 写作真正需要的是结构与检索（大纲/章节树/人物卡/伏笔），不是排版
// 因此这里保持纯文本，落库就是所见即所得。
//
// 外壳（工具条/内容区/底栏）与条目编辑器共用 EditorShell，保证两处布局一致。
import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../stores/editor.store';
import { apiClient } from '../../services/api.service';
import EditorShell, { EDITOR_TEXTAREA_CLASS } from './EditorShell';

export default function RichEditor() {
  const {
    chapterContent,
    setContent,
    currentChapterId,
    currentBookId,
    chapterOutline,
    instruction,
    isGenerating,
    closeChapter,
  } = useEditorStore();

  const taRef = useRef<HTMLTextAreaElement>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // AI 流式生成时把内容同步到文本框（并在生成结束后把光标放到末尾）
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (ta.value !== chapterContent) {
      ta.value = chapterContent;
      if (isGenerating) ta.scrollTop = ta.scrollHeight;
    }
  }, [chapterContent, isGenerating]);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);
    // 自动保存（3 秒防抖）
    if (currentChapterId && !isGenerating) {
      debouncedSave(currentChapterId, currentBookId, text, chapterOutline, instruction);
    }
  };

  // 字数口径与后端 countWords 保持一致：去空白后的字符数
  // （中文场景下按空白切词没有意义，网文平台也是这个口径）
  const charCount = chapterContent.replace(/\s/g, '').length;

  const saveNow = () => {
    if (!currentChapterId) return;
    debouncedSave(currentChapterId, currentBookId, chapterContent, chapterOutline, instruction, true);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2000);
  };

  return (
    <EditorShell
      // 不再重复显示章节标题：面包屑最后一段就是「第N章 章节名」，
      // 而这里也没法改名（改章节名走目录里的右键菜单），重复一遍只是噪音。
      // 条目编辑器保留标题区是因为那里的标题可编辑。
      statusSlot={
        <>
          {isGenerating && <span className="text-brand-primary">🤖 AI 生成中…</span>}
          {!isGenerating && savedAt && <span className="text-success">已保存</span>}
        </>
      }
      onSave={currentChapterId ? saveNow : undefined}
      saveRole="chapter-save"
      onClose={closeChapter}
      closeTitle="关闭（切到其它内容）"
      footerLeft={
        <>
          <span data-role="char-count">{charCount} 字</span>
          <span className="ml-auto">Ctrl+S 保存</span>
        </>
      }>
      <textarea
        ref={taRef}
        data-role="chapter-content"
        defaultValue={chapterContent}
        onChange={onChange}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveNow();
          }
        }}
        readOnly={isGenerating}
        placeholder={'开始创作… 选择左侧章节，或点击右侧「生成正文」让 AI 帮你写\n\n段落之间用空行分隔。'}
        className={EDITOR_TEXTAREA_CLASS}
      />
    </EditorShell>
  );
}

// ========== 自动保存 (简易防抖) ==========

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(
  chapterId: string, bookId: string | null, content: string,
  outline: string, instruction: string, immediate = false,
) {
  if (saveTimer) clearTimeout(saveTimer);
  const doSave = async () => {
    try {
      const { currentVolumeId } = useEditorStore.getState();
      await apiClient.patch(`/volumes/${currentVolumeId}/chapters/${chapterId}`, {
        content,
        chapterOutline: outline || undefined,
        instruction: instruction || undefined,
      });
    } catch (err) { console.error('保存失败:', err); }
  };
  if (immediate) { doSave(); return; }
  saveTimer = setTimeout(doSave, 3000);
}
