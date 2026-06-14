// 设置弹窗
import { useState } from 'react';
import { X, ExternalLink, User, Palette, Plug, Info } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { useTheme } from '../../hooks/useTheme';
import { useSubscriptionStore } from '../../stores/subscription.store';

type Tab = 'account' | 'appearance' | 'api' | 'about';

interface Props { open: boolean; onClose: () => void; }

export default function SettingsDialog({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('account');

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-bg-primary rounded-lg shadow-xl w-[480px] h-[400px] flex overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 左侧导航 */}
        <div className="w-36 bg-bg-secondary border-r border-border-primary flex flex-col py-2">
          <NavItem icon={<User size={15} />} label="账号" active={tab === 'account'} onClick={() => setTab('account')} />
          <NavItem icon={<Palette size={15} />} label="外观" active={tab === 'appearance'} onClick={() => setTab('appearance')} />
          <NavItem icon={<Plug size={15} />} label="接口" active={tab === 'api'} onClick={() => setTab('api')} />
          <div className="flex-1" />
          <NavItem icon={<Info size={15} />} label="关于" active={tab === 'about'} onClick={() => setTab('about')} />
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-primary">
            <h2 className="font-semibold text-sm">{
              tab === 'account' ? '👤 账号' : tab === 'appearance' ? '🎨 外观' : tab === 'api' ? '🔌 接口' : 'ℹ 关于'
            }</h2>
            <button onClick={onClose} className="text-text-tertiary hover:text-text-primary"><X size={18} /></button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {tab === 'account' && <AccountTab />}
            {tab === 'appearance' && <AppearanceTab />}
            {tab === 'api' && <ApiTab />}
            {tab === 'about' && <AboutTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 左侧导航项 */
function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${active ? 'bg-bg-active text-text-primary font-medium' : 'text-text-secondary hover:bg-bg-hover'}`}>
      {icon} {label}
    </button>
  );
}

/** 账号 Tab */
function AccountTab() {
  const { user, logout } = useAuthStore();
  const { usage } = useSubscriptionStore();
  return (
    <div className="space-y-3">
      <div className="bg-bg-secondary rounded p-3 text-sm space-y-1.5">
        <div><span className="text-text-tertiary">邮箱：</span>{user?.email || '未登录'}</div>
        <div><span className="text-text-tertiary">名称：</span>{user?.displayName || '-'}</div>
        <div><span className="text-text-tertiary">套餐：</span><span className="font-medium">{usage?.currentPlanName || 'Free'}</span></div>
      </div>
      <button onClick={logout} className="w-full py-2 text-sm text-error border border-error/30 rounded hover:bg-error/5 transition-colors">
        退出登录
      </button>
    </div>
  );
}

/** 外观 Tab */
function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-2">
      {([
        { value: 'system', label: '💻 跟随系统' },
        { value: 'light', label: '☀ 亮色' },
        { value: 'dark', label: '🌙 暗色' },
      ] as const).map(t => (
        <button key={t.value} onClick={() => setTheme(t.value)}
          className={`w-full py-2 text-sm rounded border transition-colors ${theme === t.value ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-border-primary text-text-secondary hover:bg-bg-hover'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** 接口 Tab */
function ApiTab() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-text-tertiary">后端 API 已启动，可通过 Swagger 文档浏览和测试所有接口。</p>
      <button onClick={() => window.open('http://localhost:3000/api/docs', '_blank')}
        className="w-full py-2 text-sm border border-border-primary rounded hover:bg-bg-hover flex items-center justify-center gap-2 transition-colors">
        📖 Swagger API 文档 <ExternalLink size={12} />
      </button>
      <div className="bg-bg-secondary rounded p-2 text-xs text-text-tertiary font-mono">
        http://localhost:3000/api/docs
      </div>
    </div>
  );
}

/** 关于 Tab */
function AboutTab() {
  return (
    <div className="bg-bg-secondary rounded p-3 text-xs text-text-tertiary space-y-1.5 text-center">
      <div className="text-sm text-text-primary font-semibold">AI 智能小说生成助手</div>
      <div className="font-mono">v0.1.0</div>
      <div className="pt-1 border-t border-border-primary mt-2">
        开发环境 · SQLite 本地数据库<br />
        Electron + React + NestJS
      </div>
    </div>
  );
}
