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
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border-primary bg-bg-secondary text-xs">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`px-2 py-0.5 rounded hover:bg-bg-hover ${editor?.isActive('bold') ? 'bg-bg-active font-bold' : ''}`}
        >
          B
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`px-2 py-0.5 rounded hover:bg-bg-hover italic ${editor?.isActive('italic') ? 'bg-bg-active' : ''}`}
        >
          I
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-0.5 rounded hover:bg-bg-hover ${editor?.isActive('heading', { level: 1 }) ? 'bg-bg-active' : ''}`}
        >
          H1
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-0.5 rounded hover:bg-bg-hover ${editor?.isActive('heading', { level: 2 }) ? 'bg-bg-active' : ''}`}
        >
          H2
        </button>
        <span className="text-text-tertiary mx-2">|</span>
        <button
          onClick={() => editor?.chain().focus().undo().run()}
          className="px-2 py-0.5 rounded hover:bg-bg-hover"
          title="撤销"
        >
          ↩
        </button>
        <button
          onClick={() => editor?.chain().focus().redo().run()}
          className="px-2 py-0.5 rounded hover:bg-bg-hover"
          title="重做"
        >
          ↪
        </button>
        <span className="text-text-tertiary ml-auto">
          {isGenerating && '🤖 AI 生成中...'}
        </span>
      </div>

      {/* 编辑器 */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ========== 自动保存 (简易防抖) ==========

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(
  chapterId: string,
  bookId: string | null,
  content: string,
  outline: string,
  instruction: string,
) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await apiClient.patch(`/chapters/${chapterId}`, {
        content,
        chapterOutline: outline || undefined,
        instruction: instruction || undefined,
      });
    } catch (err) {
      console.error('自动保存失败:', err);
    }
  }, 3000);
}
