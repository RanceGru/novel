// 编号 + 标题 内联编辑组件
// 用于分卷/章节的「新建」与「重命名」：左侧选择序号，右侧输入标题。
// 确认时校验序号重复：重复则就地提示，保留输入并让用户重新设置。
import { useState } from 'react';
import { Check, X } from 'lucide-react';

interface Props {
  /** 模型名，用于提示文案，如「分卷」「章节」 */
  kind: 'volume' | 'chapter';
  /** 当前序号；null 表示输入框被清空 */
  number: number | null;
  /** 当前标题 */
  title: string;
  /** 新增时传入，重命名时不传：null 表示输入框被清空/非法 */
  onNumberChange?: (n: number | null) => void;
  onTitleChange: (t: string) => void;
  /** 确认（通过调用方校验后触发）。调用方负责查重并抛错，错误信息会就地显示 */
  onConfirm: () => void | Promise<void>;
  /** 取消 */
  onCancel: () => void;
  /** 序号输入框宽度类，分卷行较窄 */
  className?: string;
  autoFocusTitle?: boolean;
}

export default function NumberTitleInput({
  kind,
  number,
  title,
  onNumberChange,
  onTitleChange,
  onConfirm,
  onCancel,
  className = '',
  autoFocusTitle = true,
}: Props) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const unit = kind === 'volume' ? '卷' : '章';
  const label = kind === 'volume' ? '分卷' : '章节';

  const handleConfirm = async () => {
    setError('');

    // 序号若可编辑，先做基本合法性校验；重复校验由调用方完成
    if (onNumberChange) {
      if (number === null || !Number.isInteger(number) || number < 0) {
        setError(`请输入有效的${unit}号`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await onConfirm();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || '保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        {onNumberChange && (
          <input
            type="number"
            min={0}
            autoFocus
            value={number === null ? '' : number}
            onChange={(e) => {
              const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
              onNumberChange(Number.isNaN(v as number) ? null : v);
            }}
            onKeyDown={handleKeyDown}
            className="w-14 shrink-0 px-1 py-0 text-sm text-center border border-brand-primary rounded bg-bg-primary"
            title={`第几${unit}`}
          />
        )}
        <input
          autoFocus={!onNumberChange || !autoFocusTitle}
          ref={el => { if (el && autoFocusTitle && onNumberChange) setTimeout(() => { el.focus(); el.select(); }, 0); }}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${label}标题`}
          className="flex-1 min-w-0 px-1 py-0 text-sm border border-brand-primary rounded bg-bg-primary"
        />
        <button onClick={handleConfirm} disabled={submitting}
          className="shrink-0 text-text-tertiary hover:text-brand-primary disabled:opacity-40"
          title="确认保存">
          <Check size={15} />
        </button>
        <button onClick={onCancel} disabled={submitting}
          className="shrink-0 text-text-tertiary hover:text-error disabled:opacity-40"
          title="取消（不保存）">
          <X size={15} />
        </button>
      </div>
      {error && <div className="mt-0.5 text-xs leading-tight text-error">{error}</div>}
    </div>
  );
}
