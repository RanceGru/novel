// 登录页面
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.service';
import { useAuthStore } from '../stores/auth.store';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiClient.post('/auth/login', { email, password });
      const { accessToken, refreshToken, user } = res.data.data;
      login({ accessToken, refreshToken, user });
      navigate('/workspace');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-bg-secondary">
      <div className="w-96 bg-bg-primary rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-2">AI 智能小说生成助手</h1>
        <p className="text-sm text-text-tertiary text-center mb-6">登录你的账号</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-border-primary rounded bg-bg-primary text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              placeholder="user@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border border-border-primary rounded bg-bg-primary text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              placeholder="输入密码"
              required
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-brand-primary text-brand-text rounded font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="text-sm text-text-tertiary text-center mt-4">
          还没有账号？{' '}
          <Link to="/register" className="text-brand-primary hover:underline">
            立即注册
          </Link>
        </p>
      </div>
    </div>
  );
}
