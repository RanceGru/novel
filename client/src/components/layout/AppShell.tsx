// 三栏布局外壳
import React from 'react';
import TopNavbar from './TopNavbar';
import LeftSidebar from './LeftSidebar';
import RightPanel from './RightPanel';
import StatusBar from './StatusBar';
import { useEditorStore } from '../../stores/editor.store';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const showRightPanel = useEditorStore((s) => s.showRightPanel);

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* 顶部导航栏 */}
      <TopNavbar />

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧边栏 */}
        <LeftSidebar />

        {/* 中央工作区 */}
        <main className="flex-1 overflow-hidden bg-editor-bg">
          {children}
        </main>

        {/* 右侧面板 */}
        {showRightPanel && <RightPanel />}
      </div>

      {/* 底部状态栏 */}
      <StatusBar />
    </div>
  );
}
