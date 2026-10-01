// 编辑器外壳 — 中间区域所有编辑器共用的布局
//
// 为什么抽出来：章节编辑器与条目编辑器原先各写一套外壳，结果样式渐渐不一致
// （内容区一个无边距贴边、一个是带边框的盒子；一个没有底栏、一个有；
// 保存按钮一个用 emoji、一个用图标…）。统一到这里后，改一次三处都跟着变。
//
// 布局：
//   ┌ 面包屑 · 标题 ............ 状态 [保存] [关闭] ┐
//   ├───────────────────────────────────────────┤
//   │ 内容（带边框的编辑框，四周留白）              │
//   ├───────────────────────────────────────────┤
//   │ 底栏：字数 / 未保存 / Ctrl+S 提示            │
//   └───────────────────────────────────────────┘
import { Save, X } from 'lucide-react';
import EditorBreadcrumb from './EditorBreadcrumb';

/** 内容区编辑框的统一样式（正文/条目/草稿三处共用，保证视觉一致） */
export const EDITOR_TEXTAREA_CLASS =
  'w-full h-full min-h-[300px] p-3 text-sm leading-relaxed border border-border-primary rounded ' +
  'bg-bg-primary text-text-primary resize-none focus:outline-none focus:border-brand-primary';

interface Props {
  /** 面包屑后的标题区（可传只读文本或输入框）；不传则不显示 */
  titleSlot?: React.ReactNode;
  /** 右侧状态区（如「已保存」「AI 生成中…」「保存失败」） */
  statusSlot?: React.ReactNode;
  onSave?: () => void;
  saveDisabled?: boolean;
  /** 保存按钮的文案与 data-role（各编辑器沿用自己原有的 role，便于测试定位） */
  saveLabel?: string;
  saveRole?: string;
  saving?: boolean;
  onClose?: () => void;
  closeTitle?: string;
  /** 底栏左侧内容（字数、未保存提示等） */
  footerLeft?: React.ReactNode;
  children: React.ReactNode;
}

export default function EditorShell({
  titleSlot, statusSlot, onSave, saveDisabled, saveLabel = '保存', saveRole = 'editor-save',
  saving, onClose, closeTitle = '关闭', footerLeft, children,
}: Props) {
  return (
    <div className="h-full flex flex-col">
      {/* 工具条 */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-primary bg-bg-secondary text-xs">
        <EditorBreadcrumb />
        {titleSlot && (
          <>
            <span className="text-text-tertiary shrink-0">·</span>
            {titleSlot}
          </>
        )}
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {statusSlot}
          {onSave && (
            // 与右侧栏「生成正文」同款：实心主题色底 + 反白图标文字
            <button data-role={saveRole} onClick={onSave} disabled={saveDisabled || saving}
              className="px-2.5 py-1 bg-brand-primary text-brand-text rounded hover:bg-brand-hover transition-colors flex items-center gap-1 disabled:opacity-50"
              title="保存 (Ctrl+S)">
              <Save size={12} /> {saving ? '保存中...' : saveLabel}
            </button>
          )}
          {onClose && (
            <button onClick={onClose}
              className="px-1.5 py-0.5 text-text-tertiary hover:text-text-primary rounded hover:bg-bg-hover"
              title={closeTitle}>
              <X size={13} />
            </button>
          )}
        </span>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>

      {/* 底栏 */}
      <div className="px-3 py-1 text-[11px] text-text-tertiary border-t border-border-primary flex items-center gap-3">
        {footerLeft}
      </div>
    </div>
  );
}
