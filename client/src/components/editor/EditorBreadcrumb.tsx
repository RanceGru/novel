// 编辑器路径面包屑 — 显示「当前编辑的内容在书里的哪个位置」
//
// 形如：示例作品 › 目录 › 第1卷 分卷1 › 第1章 章节1
// 作用同文件管理器里的路径，正文编辑器与条目编辑器共用。
import { ChevronRight } from 'lucide-react';
import { useEditorStore } from '../../stores/editor.store';

export default function EditorBreadcrumb() {
  const path = useEditorStore((s) => s.currentPath);

  if (!path.length) {
    return <span className="text-text-tertiary">未选择内容</span>;
  }

  return (
    <nav data-role="editor-breadcrumb" title={path.join(' › ')}
      className="flex items-center gap-0.5 min-w-0 text-text-tertiary">
      {path.map((seg, i) => {
        const last = i === path.length - 1;
        return (
          <span key={`${seg}-${i}`} className="flex items-center gap-0.5 min-w-0">
            {i > 0 && <ChevronRight size={11} className="shrink-0 opacity-60" />}
            <span className={last
              ? 'truncate text-text-secondary'          // 当前内容：颜色略亮
              : 'truncate max-w-[8rem]'}>               {/* 上级：限制宽度，给当前项让位 */}
              {seg}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
