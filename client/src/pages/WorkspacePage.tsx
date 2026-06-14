// 写作台主页面 — 三栏布局
import AppShell from '../components/layout/AppShell';
import RichEditor from '../components/editor/RichEditor';

export default function WorkspacePage() {
  return (
    <AppShell>
      <RichEditor />
    </AppShell>
  );
}
