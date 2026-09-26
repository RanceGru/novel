// 用户与认证类型

/** 用户基本信息 */
export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

/** 注册请求 */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

/** 登录请求 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** 登录响应 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
}

/** Refresh Token 请求 */
export interface RefreshRequest {
  refreshToken: string;
}

/** Refresh Token 响应 */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** 更新用户信息请求 */
export interface UpdateUserRequest {
  displayName?: string;
  avatarUrl?: string;
}

/** JWT Token 载荷 */
export interface JwtPayload {
  sub: string; // user ID
  email: string;
  plan: string; // SubscriptionTier
  iat: number;
  exp: number;
}
