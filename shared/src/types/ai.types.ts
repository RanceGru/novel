// AI 生成相关类型

// ========== 请求类型 ==========

/** AI 内容生成请求 */
export interface GenerateContentRequest {
  bookId: string;
  chapterId: string;
  chapterOutline: string; // 章纲
  instruction: string; // 写作指令
  targetWordCount: number; // 目标字数
  styleParams?: StyleParams; // 文风参数
}

/** AI 章纲生成请求 */
export interface GenerateOutlineRequest {
  bookId: string;
  volumeId?: string;
  chapterId?: string;
  type: 'outline' | 'volume_outline' | 'chapter_outline';
  context: string; // 上下文信息
  instruction?: string;
}

/** AI 角色生成请求 */
export interface GenerateCharactersRequest {
  bookId: string;
  count: number;
  type: 'protagonist' | 'supporting' | 'antagonist';
  context: string;
  instruction?: string;
}

/** AI 改写请求 */
export interface RewriteRequest {
  bookId: string;
  chapterId: string;
  originalText: string;
  instruction: string;
  mode: 'word' | 'sentence' | 'paragraph' | 'full';
}

/** AI 审查请求 */
export interface ReviewRequest {
  bookId: string;
  chapterId: string;
  content: string;
  type: 'quality' | 'consistency' | 'dehumanize';
}

/** 文风参数 */
export interface StyleParams {
  tone?: string; // 语气 (formal/casual/humorous/serious)
  pace?: string; // 节奏 (fast/moderate/slow)
  perspective?: string; // 视角 (first_person/third_person_limited/third_person_omniscient)
  languageStyle?: string; // 语言风格
  customInstructions?: string; // 自定义指令
}

// ========== SSE 事件类型 ==========

/** SSE 事件类型 */
export type SSEEventType = 'start' | 'token' | 'progress' | 'complete' | 'error';

/** SSE 开始事件 */
export interface SSEStartEvent {
  type: 'start';
  requestId: string;
  estimatedTokens: number;
}

/** SSE Token 事件（逐字流式输出） */
export interface SSETokenEvent {
  type: 'token';
  text: string;
  index: number;
}

/** SSE 进度事件（定期发送） */
export interface SSEProgressEvent {
  type: 'progress';
  tokensGenerated: number;
  estimatedProgress: number; // 0~1
}

/** SSE 完成事件 */
export interface SSECompleteEvent {
  type: 'complete';
  requestId: string;
  fullText: string;
  metadata: {
    modelUsed: string;
    modelTier: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    generationDurationMs: number;
    wordCount: number;
    finishReason: string;
  };
  usage: {
    tokensConsumedThisRequest: number;
    quotaTokensRemaining: number;
    purchasedTokensRemaining: number;
    totalWordsGeneratedThisMonth: number;
  };
  reviewTaskId?: string;
}

/** SSE 错误事件 */
export interface SSEErrorEvent {
  type: 'error';
  code: string;
  message: string;
  retryable: boolean;
  retryAfter?: number;
}

/** SSE 事件联合类型 */
export type SSEEvent = SSEStartEvent | SSETokenEvent | SSEProgressEvent | SSECompleteEvent | SSEErrorEvent;

// ========== AI 生成结果 ==========

/** AI 生成结果 */
export interface GenerationResult {
  requestId: string;
  content: string;
  metadata: {
    modelUsed: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    generationDurationMs: number;
    wordCount: number;
  };
  usage: {
    tokensConsumedThisRequest: number;
    quotaTokensRemaining: number;
    purchasedTokensRemaining: number;
  };
}

// ========== AI 审查结果 ==========

/** AI 去味审查结果 */
export interface DehumanizeReviewResult {
  reviewTaskId: string;
  chapterId: string;
  overallScore: number; // 0~100, 越高越自然
  dimensionScores: {
    repetition: number; // 重复句式
    transition: number; // 格式化过渡词
    emotion: number; // 情感起伏
    dialogue: number; // 对话自然度
    variety: number; // 句式多样性
    vocabulary: number; // 词汇丰富度
    creativity: number; // 创意度
  };
  flaggedSegments: Array<{
    text: string;
    issue: string;
    suggestion: string;
    position: { start: number; end: number };
    severity: 'low' | 'medium' | 'high';
  }>;
  rewrittenText: string;
  diffWithOriginal: string;
}

/** 质量审查结果 */
export interface QualityReviewResult {
  reviewTaskId: string;
  chapterId: string;
  overallScore: number;
  issues: Array<{
    type: 'plot_hole' | 'character_inconsistency' | 'setting_conflict' | 'pacing_issue' | 'grammar';
    description: string;
    severity: 'low' | 'medium' | 'high';
    suggestion: string;
  }>;
}
