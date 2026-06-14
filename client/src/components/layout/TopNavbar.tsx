// 顶部导航栏
import { useAuthStore } from '../../stores/auth.store';
import { useTheme } from '../../hooks/useTheme';

export default function TopNavbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, setTheme } = useTheme();

  return (
    <header className="h-10 bg-bg-secondary border-b border-border-primary flex items-center justify-between px-3 select-none shrink-0">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className="font-semibold text-text-primary">AI 智能小说生成助手</span>
        <span className="text-text-tertiary text-xs">v0.1.0</span>
      </div>

      <div className="flex items-center gap-3 text-xs text-text-secondary">
        {/* 主题切换 */}
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
          className="bg-transparent border border-border-primary rounded px-1 py-0.5 text-xs"
        >
          <option value="system">跟随系统</option>
          <option value="light">亮色</option>
          <option value="dark">暗色</option>
        </select>

        {/* 用户信息 */}
        {user && (
          <>
            <span>{user.displayName || user.email}</span>
            <button
              onClick={logout}
              className="text-text-tertiary hover:text-text-primary transition-colors"
            >
              退出
            </button>
          </>
        )}
      </div>
    </header>
  );
}
