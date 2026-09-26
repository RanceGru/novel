// 定价页面
import { useEffect } from 'react';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { Check, X } from 'lucide-react';

export default function PricingPage() {
  const { plans, loadPlans, subscribe, currentPlan } = useSubscriptionStore();

  useEffect(() => { loadPlans(); }, []);

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-xl font-bold text-center mb-6">选择适合你的套餐</h1>
      <div className="grid grid-cols-5 gap-3 max-w-5xl mx-auto">
        {plans.map((plan: any) => (
          <div key={plan.tier}
            className={`rounded-lg border p-4 flex flex-col ${currentPlan === plan.tier ? 'border-brand-primary ring-1 ring-brand-primary' : 'border-border-primary'}`}>
            <h3 className="font-bold text-sm">{plan.name}</h3>
            <div className="text-2xl font-bold my-2">¥{plan.monthlyPrice}<span className="text-xs text-text-tertiary font-normal">/月</span></div>
            <ul className="text-xs space-y-1.5 flex-1">
              <li className="flex items-center gap-1">
                <span className="text-text-primary">{plan.totalWordLimit >= 1000000 ? (plan.totalWordLimit / 10000).toFixed(0) + '万' : (plan.totalWordLimit / 10000).toFixed(1) + '万'}</span> 字额度
              </li>
              <li>📚 {plan.workStorageSlots} 个作品空间</li>
              <li>🔷 {(plan.monthlyTokenQuota / 10000).toFixed(0)}万 Token</li>
              <li>🤖 {plan.modelType} 模型</li>
              <li>⚡ {plan.parallelSlots} 并行槽</li>
              <li>{plan.offlineMode ? <Check size={14} className="text-success" /> : <X size={14} className="text-text-tertiary" />} 离线模式</li>
              <li>{plan.aiDehumanizeReview ? <Check size={14} className="text-success" /> : <X size={14} className="text-text-tertiary" />} AI去味</li>
            </ul>
            <button
              onClick={() => subscribe(plan.tier)}
              disabled={currentPlan === plan.tier}
              className={`mt-3 w-full py-1.5 rounded text-xs font-medium ${currentPlan === plan.tier ? 'bg-bg-active text-text-tertiary cursor-default' : 'bg-brand-primary text-brand-text hover:bg-brand-hover'}`}>
              {currentPlan === plan.tier ? '当前套餐' : plan.monthlyPrice === 0 ? '免费使用' : '升级'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
