// Tiptap 富文本编辑器组件
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { useEditorStore } from '../../stores/editor.store';
import { apiClient } from '../../services/api.service';

export default function RichEditor() {
  const {
    chapterContent,
    setContent,
    currentChapterId,
    currentBookId,
    chapterOutline,
    instruction,
    isGenerating,
  } = useEditorStore();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: '开始创作... 选择左侧章节，或点击右侧「生成正文」让 AI 帮你写',
      }),
      Highlight,
    ],
    content: chapterContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      setContent(text);

      // 自动保存 (3秒防抖)
      if (currentChapterId && !isGenerating) {
        debouncedSave(currentChapterId, currentBookId, text, chapterOutline, instruction);
      }
    },
    editable: !isGenerating,
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
  });

  // 当外部内容变化时（AI 流式生成），同步更新编辑器
  if (editor && chapterContent !== editor.getText() && isGenerating) {
    editor.commands.setContent(
      chapterContent
        .split('\n')
        .map((p) => (p.trim() ? `<p>${p}</p>` : '<p><br></p>'))
        .join(''),
      false,
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border-primary bg-bg-secondary text-xs flex-wrap">
        <Btn editor={editor} cmd="bold" label="B" title="加粗" />
        <Btn editor={editor} cmd="italic" label="I" title="斜体" />
        <Btn editor={editor} cmd="heading1" label="H1" title="一级标题" />
        <Btn editor={editor} cmd="heading2" label="H2" title="二级标题" />
        <Btn editor={editor} cmd="heading3" label="H3" title="三级标题" />
        <span className="text-text-tertiary">|</span>
        <Btn editor={editor} cmd="bulletList" label="•≡" title="无序列表" />
        <Btn editor={editor} cmd="orderedList" label="1." title="有序列表" />
        <Btn editor={editor} cmd="blockquote" label="❝" title="引用" />
        <Btn editor={editor} cmd="horizontalRule" label="—" title="分割线" />
        <span className="text-text-tertiary">|</span>
        <Btn editor={editor} cmd="undo" label="↩" title="撤销" />
        <Btn editor={editor} cmd="redo" label="↪" title="重做" />
        <span className="text-text-tertiary ml-auto flex items-center gap-1">
          {isGenerating && '🤖 AI 生成中...'}
          {currentChapterId && !isGenerating && (
            <button onClick={() => debouncedSave(currentChapterId, currentBookId, chapterContent, chapterOutline, instruction, true)}
              className="px-2 py-0.5 text-brand-primary hover:bg-bg-hover rounded" title="手动保存 (Ctrl+S)">
              💾 保存
            </button>
          )}
        </span>
      </div>

      {/* 编辑器 */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ========== 工具栏按钮组件 ==========
function Btn({ editor, cmd, label, title }: { editor: any; cmd: string; label: string; title: string }) {
  const cmdMap: Record<string, () => void> = {
    bold: () => editor?.chain().focus().toggleBold().run(),
    italic: () => editor?.chain().focus().toggleItalic().run(),
    heading1: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
    heading2: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    heading3: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
    bulletList: () => editor?.chain().focus().toggleBulletList().run(),
    orderedList: () => editor?.chain().focus().toggleOrderedList().run(),
    blockquote: () => editor?.chain().focus().toggleBlockquote().run(),
    horizontalRule: () => editor?.chain().focus().setHorizontalRule().run(),
    undo: () => editor?.chain().focus().undo().run(),
    redo: () => editor?.chain().focus().redo().run(),
  };
  const activeMap: Record<string, boolean> = {
    bold: editor?.isActive('bold'),
    italic: editor?.isActive('italic'),
    heading1: editor?.isActive('heading', { level: 1 }),
    heading2: editor?.isActive('heading', { level: 2 }),
    heading3: editor?.isActive('heading', { level: 3 }),
    bulletList: editor?.isActive('bulletList'),
    orderedList: editor?.isActive('orderedList'),
    blockquote: editor?.isActive('blockquote'),
  };
  return (
    <button onClick={cmdMap[cmd]} title={title}
      className={`px-2 py-0.5 rounded hover:bg-bg-hover ${activeMap[cmd] ? 'bg-bg-active font-bold' : ''}`}>
      {label}
    </button>
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
      await apiClient.patch(`/volumes/${currentVolumeId}/chapters/${chapterId}`, { content, chapterOutline: outline || undefined, instruction: instruction || undefined });
    } catch (err) { console.error('保存失败:', err); }
  };
  if (immediate) { doSave(); return; }
  saveTimer = setTimeout(doSave, 3000);
}
