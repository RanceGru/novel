// 底部状态栏
import { useEffect } from 'react';
import { useEditorStore } from '../../stores/editor.store';
import { useProjectStore } from '../../stores/project.store';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { useTokenStore } from '../../stores/token.store';

export default function StatusBar() {
  const content = useEditorStore((s) => s.chapterContent);
  const currentBook = useProjectStore((s) => s.currentBook);
  const wordCount = content.length;
  const { usage, loadUsage } = useSubscriptionStore();
  const { balance, loadBalance } = useTokenStore();

  useEffect(() => {
    loadUsage();
    loadBalance();
  }, []);

  return (
    <footer className="h-7 bg-bg-secondary border-t border-border-primary flex items-center justify-between px-3 text-xs text-text-tertiary shrink-0 select-none">
      <div className="flex items-center gap-4">
        <span>📊 当前字数: {wordCount.toLocaleString()}</span>
        {currentBook && (
          <span>📖 {currentBook.title}: {currentBook.wordCount.toLocaleString()} 字</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
          ☁ 云端同步
        </span>
        <span>🤖 DeepSeek</span>
        {usage && (
          <span title="Token: 本月已用/总额度">
            🔷 {(usage.monthlyTokensUsed / 10000).toFixed(1)}万/{(usage.monthlyTokenQuota / 10000).toFixed(1)}万
          </span>
        )}
        {balance && balance.purchasedTokensRemaining > 0 && (
          <span title="额外购买Token">💰 {(balance.purchasedTokensRemaining / 10000).toFixed(1)}万</span>
        )}
        <span>[{usage?.currentPlanName || 'Free'}]</span>
      </div>
    </footer>
  );
}
