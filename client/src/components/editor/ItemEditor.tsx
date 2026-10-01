// 条目编辑器 — 左栏点击「大纲/卷纲/章纲/角色子项/世界观条目」后，在中间区域编辑其内容
//
// 这些条目都只有 title + content 两个可编辑字段，因此共用同一个编辑器。
// 与章节正文的区别：正文走 RichEditor（含 AI 生成、章纲快照等），条目走本组件。
// 两者的外壳（工具条/内容区/底栏）共用 EditorShell，保证布局一致。
import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../stores/editor.store';
import EditorShell, { EDITOR_TEXTAREA_CLASS } from './EditorShell';

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
  const charCount = content.replace(/\s/g, '').length;

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
    <EditorShell
      titleSlot={selectedDoc.editableTitle ? (
        <input data-role="item-title" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="名称"
          className="min-w-0 flex-1 max-w-xs px-1.5 py-0.5 text-xs border border-border-primary rounded bg-bg-primary" />
      ) : (
        <span data-role="item-title" className="font-medium text-text-primary truncate max-w-[18rem]">{selectedDoc.title}</span>
      )}
      statusSlot={
        <>
          {error && <span className="text-error">{error}</span>}
          {saved && <span className="text-success">已保存</span>}
        </>
      }
      onSave={doSave}
      saving={saving}
      saveRole="item-save"
      onClose={closeDoc}
      closeTitle="关闭"
      footerLeft={
        <>
          <span data-role="item-count">{charCount} 字</span>
          {dirty && <span className="text-warning">未保存</span>}
          <span className="ml-auto">Ctrl+S 保存</span>
        </>
      }>
      <textarea
        data-role="item-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doSave(); } }}
        placeholder={`在此撰写「${selectedDoc.title}」的内容…`}
        className={EDITOR_TEXTAREA_CLASS}
      />
    </EditorShell>
  );
}
