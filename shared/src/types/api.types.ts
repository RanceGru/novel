// 通用 API 请求/响应类型
// 前后端共享的 API 契约

/** 统一 API 成功响应包装 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
  requestId: string;
}

/** 分页请求参数 */
export interface PaginationRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/** 分页元数据 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** 分页响应 */
export interface PaginatedResponse<T = unknown> {
  items: T[];
  meta: PaginationMeta;
}

/** 统一 API 错误响应 */
export interface ApiErrorResponse {
  success: false;
  error: {
    /** 机器可读错误码 */
    code: string;
    /** 用户可读错误信息（中文） */
    message: string;
    /** 调试详情（仅开发环境） */
    detail?: string;
    requestId: string;
    timestamp: string;
    /** 是否可重试 */
    retryable: boolean;
    /** 重试等待秒数 */
    retryAfter?: number;
    /** 建议操作 */
    actions?: ErrorAction[];
  };
}

/** 错误操作建议 */
export interface ErrorAction {
  label: string;
  type: 'link' | 'button';
  to?: string;
  action?: string;
}

/** API 列表查询参数 */
export interface ListQueryParams extends PaginationRequest {
  search?: string;
  status?: string;
}
