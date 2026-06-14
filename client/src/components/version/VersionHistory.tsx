// 版本历史组件
import { useEffect, useState } from 'react';
import { useVersionStore } from '../../stores/version.store';
import { useEditorStore } from '../../stores/editor.store';
import { RotateCcw } from 'lucide-react';

export default function VersionHistory() {
  const { versions, loadHistory, revert } = useVersionStore();
  const { currentChapterId } = useEditorStore();
  const [viewing, setViewing] = useState<any>(null);

  useEffect(() => {
    if (currentChapterId) loadHistory(currentChapterId);
  }, [currentChapterId]);

  return (
    <div className="text-xs h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-border-primary font-semibold text-text-tertiary">
        📜 版本历史 ({versions.length})
      </div>
      <div className="flex-1 overflow-y-auto">
        {versions.map((v: any) => (
          <div key={v.id} className="px-3 py-1.5 border-b border-border-primary/50 hover:bg-bg-hover flex items-center gap-2">
            <span className="font-mono text-text-tertiary">v{v.versionNumber}</span>
            <span className="flex-1 truncate">{v.label || '快照'}</span>
            <span className="text-text-tertiary">{v.wordCount}字</span>
            <span className="text-text-tertiary text-[10px]">{new Date(v.createdAt).toLocaleDateString('zh-CN')}</span>
            <button onClick={async () => {
              const full = await useVersionStore.getState().getVersion(v.id);
              setViewing(full);
            }} className="text-brand-primary">查看</button>
            <button onClick={async () => {
              if (confirm(`回退到版本 ${v.versionNumber}？`)) {
                await revert(v.id);
                loadHistory(currentChapterId!);
              }
            }} className="text-error" title="回退"><RotateCcw size={12} /></button>
          </div>
        ))}
      </div>
      {/* 版本详情弹窗 */}
      {viewing && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setViewing(null)}>
          <div className="bg-bg-primary rounded-lg shadow-xl p-4 w-[600px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">版本 v{viewing.versionNumber} — {viewing.label || '快照'}</h3>
            <pre className="text-xs whitespace-pre-wrap bg-bg-secondary p-3 rounded max-h-[50vh] overflow-y-auto">
              {viewing.content.substring(0, 5000)}
              {viewing.content.length > 5000 && '\n...(内容过长，仅显示前5000字)'}
            </pre>
            <button className="mt-2 text-text-tertiary text-xs" onClick={() => setViewing(null)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
