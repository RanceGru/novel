// 注册页面
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.service';
import { useAuthStore } from '../stores/auth.store';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 8) {
      setError('密码至少需要8位');
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient.post('/auth/register', {
        email,
        password,
        displayName: displayName || undefined,
      });
      const { accessToken, refreshToken, user } = res.data.data;
      login({ accessToken, refreshToken, user });
      navigate('/workspace');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-bg-secondary">
      <div className="w-96 bg-bg-primary rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-2">创建账号</h1>
        <p className="text-sm text-text-tertiary text-center mb-6">开始你的创作之旅</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-border-primary rounded bg-bg-primary text-sm focus:outline-none focus:border-brand-primary"
              placeholder="user@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              显示名称 <span className="text-text-tertiary">(可选)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full p-2 border border-border-primary rounded bg-bg-primary text-sm focus:outline-none focus:border-brand-primary"
              placeholder="你的笔名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border border-border-primary rounded bg-bg-primary text-sm focus:outline-none focus:border-brand-primary"
              placeholder="至少8位"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2 border border-border-primary rounded bg-bg-primary text-sm focus:outline-none focus:border-brand-primary"
              placeholder="再次输入密码"
              required
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-brand-primary text-brand-text rounded font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="text-sm text-text-tertiary text-center mt-4">
          已有账号？{' '}
          <Link to="/login" className="text-brand-primary hover:underline">
            立即登录
          </Link>
        </p>
      </div>
    </div>
  );
}
