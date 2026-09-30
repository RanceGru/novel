// 条目编辑器 — 左栏点击「大纲/卷纲/章纲/角色子项/世界观条目」后，在中间区域编辑其内容
//
// 这些条目都只有 title + content 两个可编辑字段，因此共用同一个编辑器。
// 与章节正文的区别：正文走 RichEditor（含 AI 生成、章纲快照等），条目走本组件。
import { useEffect, useRef, useState } from 'react';
import { Save, X } from 'lucide-react';
import { useEditorStore } from '../../stores/editor.store';
import EditorBreadcrumb from './EditorBreadcrumb';

export default function ItemEditor() {
  const { selectedDoc, saveDoc, closeDoc } = useEditorStore();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 载入内容时按内容区分，避免切换条目时把上一条的内容留在框里 */
  const loadedFor = useRef<string | null>(null);

  // 切换条目时重新载入内容
  useEffect(() => {
    if (!selectedDoc) { loadedFor.current = null; return; }
    const key = `${selectedDoc.kind}:${selectedDoc.id}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setTitle(selectedDoc.title);
    setSaved(false);
    setError(null);
    // 内容由选中时一并带过来（见各左栏组件的 selectDoc 调用）
    setContent(selectedDoc.content ?? '');
  }, [selectedDoc]);

  if (!selectedDoc) return null;

  const dirty = content !== (selectedDoc.content ?? '') || title !== selectedDoc.title;

  const doSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveDoc(content, selectedDoc.editableTitle ? title.trim() || selectedDoc.title : undefined);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏：路径 + 条目名称 + 保存 */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-primary bg-bg-secondary text-xs">
        <EditorBreadcrumb />
        <span className="text-text-tertiary shrink-0">·</span>
        {selectedDoc.editableTitle ? (
          <input data-role="item-title" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="名称"
            className="min-w-0 flex-1 max-w-xs px-1.5 py-0.5 text-xs border border-border-primary rounded bg-bg-primary" />
        ) : (
          <span data-role="item-title" className="font-medium text-text-primary truncate">{selectedDoc.title}</span>
        )}
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {error && <span className="text-error">{error}</span>}
          {saved && <span className="text-success">已保存</span>}
          <button data-role="item-save" onClick={doSave} disabled={saving}
            className="px-2 py-0.5 text-brand-primary hover:bg-bg-hover rounded flex items-center gap-1 disabled:opacity-50"
            title="保存 (Ctrl+S)">
            <Save size={12} /> {saving ? '保存中...' : '保存'}
          </button>
          <button onClick={closeDoc} className="px-1.5 py-0.5 text-text-tertiary hover:text-text-primary rounded hover:bg-bg-hover"
            title="关闭">
            <X size={13} />
          </button>
        </span>
      </div>

      {/* 内容编辑区 */}
      <div className="flex-1 overflow-y-auto p-4">
        <textarea
          data-role="item-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doSave(); } }}
          placeholder={`在此撰写「${selectedDoc.title}」的内容…`}
          className="w-full h-full min-h-[300px] p-3 text-sm leading-relaxed border border-border-primary rounded bg-bg-primary text-text-primary resize-none focus:outline-none focus:border-brand-primary"
        />
      </div>

      {/* 状态栏 */}
      <div className="px-3 py-1 text-[11px] text-text-tertiary border-t border-border-primary flex items-center gap-3">
        <span>{content.trim() ? `${content.trim().length} 字` : '暂无内容'}</span>
        {dirty && <span className="text-warning">未保存</span>}
        <span className="ml-auto">Ctrl+S 保存</span>
      </div>
    </div>
  );
}
