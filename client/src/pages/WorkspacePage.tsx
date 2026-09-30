// 写作台主页面 — 三栏布局
//
// 中间区域有三种编辑态，互斥（由 editor.store 保证）：
//   · 未保存文本（功能区「新建文本」）→ DraftEditor
//   · 选中左侧「条目」（大纲/卷纲/章纲/角色子项/世界观条目）→ ItemEditor
//   · 选中目录里的章节 → RichEditor（正文）
import AppShell from '../components/layout/AppShell';
import RichEditor from '../components/editor/RichEditor';
import ItemEditor from '../components/editor/ItemEditor';
import DraftEditor from '../components/editor/DraftEditor';
import { useEditorStore } from '../stores/editor.store';

export default function WorkspacePage() {
  const selectedDoc = useEditorStore((s) => s.selectedDoc);
  const draftText = useEditorStore((s) => s.draftText);

  return (
    <AppShell>
      {draftText !== null ? <DraftEditor /> : selectedDoc ? <ItemEditor /> : <RichEditor />}
    </AppShell>
  );
}
