// 顶部导航栏
import { PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useEditorStore } from '../../stores/editor.store';

export default function TopNavbar() {
  const showRightPanel = useEditorStore((s) => s.showRightPanel);
  const toggleRightPanel = useEditorStore((s) => s.toggleRightPanel);

  return (
    <header className="h-10 bg-bg-secondary border-b border-border-primary flex items-center justify-between px-3 select-none shrink-0">
      <span className="font-semibold text-sm text-text-primary">AI 智能小说生成助手</span>
      <button
        onClick={toggleRightPanel}
        className="text-text-tertiary hover:text-text-primary transition-colors"
        title={showRightPanel ? '隐藏面板' : '显示面板'}
      >
        {showRightPanel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
      </button>
    </header>
  );
}
