# AI智能小说生成助手 — 技术规格文档

> **版本**: v2.8
> **最后更新**: 2026-07-01 (纲树-章节同步系统设计 + 数据模型扩展)
> **目标**: 实现一款支持500万字级网文创作的跨平台（Windows / macOS）桌面AI写作助手
> **设计参考**: Codex 桌面端风格
> **数据架构**: 云端优先（Cloud-First），所有数据默认存储于云端服务器，Lite及以上套餐可下载到本地

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
   - [2.4 云端版本管理系统](#24-云端版本管理系统)
3. [用户与订阅系统](#3-用户与订阅系统)
4. [界面设计](#4-界面设计)
5. [功能规格](#5-功能规格)
   - [5.4 纲树-章节同步系统](#54-纲树-章节同步系统-v28)
6. [数据模型](#6-数据模型)
7. [AI系统设计](#7-ai系统设计) — 含API用量管理层、多Provider路由、成本控制
8. [记忆系统](#8-记忆系统)
9. [Agent系统](#9-agent系统)
10. [云端基础设施](#10-云端基础设施)
11. [安全与隐私](#11-安全与隐私)
12. [开发路线图](#12-开发路线图)
13. [附录](#13-附录)
14. [产品管理补充](#14-产品管理补充)
15. [软件架构补充](#15-软件架构补充)
16. [前端开发补充](#16-前端开发补充)
17. [后端开发补充](#17-后端开发补充)
18. [DevOps补充](#18-devops补充)
19. [完善方案](#19-完善方案) — v2.7 审计发现的全部问题与分阶段修复计划

---

## 1. 项目概述

### 1.1 项目目标

构建一款专业的AI辅助长篇小说写作桌面软件，核心能力：

- **超长文本创作**: 支持500万字以上的网文小说创作
- **结构化写作**: 建立"作品设定 → 大纲 → 卷纲 → 章纲 → 正文"五层创作体系
- **AI深度协作**: 通过多Agent系统，在架构、人设、世界构建、文风模拟、质检等环节提供专业级AI辅助
- **长期记忆**: 三级记忆架构确保超长篇小说的人物、伏笔、设定一致性
- **云端优先**: 所有创作数据实时同步至云端服务器，用户可在任意设备上访问自己的作品
- **套餐分级**: Free/Lite/Basic/Plus/Pro 五级套餐，每级享有不同的字数额度和作品存储空间；Free不可下载数据，Lite及以上支持下载到本地离线创作

### 1.2 目标平台

| 平台 | 版本要求 | 备注 |
|------|---------|------|
| Windows | Windows 10+ | 主要目标平台 |
| macOS | macOS 12+ (Apple Silicon) | 兼容 Intel Mac |

### 1.3 商业模式

#### 1.3.1 套餐体系

| 参数 | Free | Lite | Basic | Plus | Pro |
|------|------|------|-------|------|-----|
| **月费** | ¥0 | ¥29 | ¥69 | ¥129 | ¥249 |
| **作品字数额度** | 20万字 | 50万字 | 100万字 | 200万字 | 500万字 |
| **作品存储空间** | 1个 | 3个 | 5个 | 7个 | 15个 |
| **Token月额度** | 20万 | 50万 | 100万 | 200万 | 500万 |
| **可用模型** | Flash | Flash | Pro | Pro | Pro |
| **数据下载** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **并行生成槽位** | 1 | 3 | 5 | 7 | 9 |
| **AI去味审查** | ❌ | ❌ | ✅ | ✅ | ✅ |

> **模型说明**: Flash 模型 = 轻量快速模型（如 DeepSeek-V4-Flash / Claude Haiku），成本低、速度快，适合基础文本生成。Pro 模型 = 旗舰深度模型（如 DeepSeek-V4-Pro / Claude Opus / Claude Sonnet），文本质量高、风格控制精准，适合正式创作。Free 和 Lite 使用 Flash 以控制成本；Basic 及以上解锁 Pro 模型，创作质量有质的飞跃。

#### 1.3.2 核心概念说明

**字数额度**：套餐包含的累计生成文字总量上限。达到上限后需升级套餐或购买增量包。

**作品存储空间**：可同时保存的独立作品（书籍项目）数量。每个作品空间包含：
- 该作品的所有章节正文内容
- 对应的上下文记忆数据（事件记忆、角色状态快照、伏笔追踪、设定补丁、风格锚点等）

> **空间不足处理**: 当作品存储空间已满但用户需要创建新作品时，必须**清空当前某个已占用作品的全部数据**（包括正文和记忆数据），释放该空间后才可创建新作品。系统会在清空前强制要求导出数据备份。

**Token月额度**：每月免费赠送的Token用量。Token用于AI生成时消耗（1字正文 ≈ 1.5 Token，含Prompt上下文）。月额度用完后仍可继续使用AI功能，超出部分需**购买Token增量包**（详见 3.5 节）。

**并行生成槽位**：同时向AI模型发起多少个独立的生成请求。例如 Pro 的 9 个槽位意味着用户可以同时生成 9 个不同章节或片段。槽位越多，批量创作效率越高。技术上受限于服务端 API 速率限制（RPM）和代理层的并发连接池。

**AI去味审查**：检测并消除AI生成文本中的"机器味"——包括重复句式、格式化过渡词、缺乏情感起伏、角色对话模板化等问题。该功能调用专门的审查模型对文本进行"人性化润色"，使文章读起来更接近人类作家的风格（详见 4.10.2 节）。

#### 1.3.3 各套餐详细权益对比

| 权益项 | Free | Lite | Basic | Plus | Pro |
|--------|------|------|-------|------|-----|
| 字数额度 | 20万 | 50万 | 100万 | 200万 | 500万 |
| 作品空间 | 1个 | 3个 | 5个 | 7个 | 15个 |
| Token月额度 | 20万 | 50万 | 100万 | 200万 | 500万 |
| 模型类型 | Flash | Flash | Pro | Pro | Pro |
| 并行生成槽位 | 1 | 3 | 5 | 7 | 9 |
| 数据下载 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 离线创作 | ❌ | ✅ | ✅ | ✅ | ✅ |
| AI去味审查 | ❌ | ❌ | ✅ | ✅ | ✅ |
| Agent系统 | 无 | 架构师 | +人设师+质检员 | +世界构建师 | +文风模拟师 |
| 文风自定义 | 预设3种 | 预设10种 | 上传1本分析 | 上传5本混合 | 无限制 |
| 版本历史 | 3个 | 10个 | 30个 | 100个 | 无限制 |
| Token购买 | ✅ | ✅ | ✅ | ✅ | ✅ |
| API接入 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 技术支持 | 社区 | 邮件 | 邮件 | 优先 | 专属 |

### 1.4 设计参考

界面风格参考 Codex 桌面端：
- 左侧侧边栏 + 中央工作区 + 右侧面板的三栏布局
- 顶部导航栏（File / Edit / View / Window / Help）
- 优雅的深色/浅色双主题
- 流畅的打字机效果AI生成展示

---

## 2. 技术架构

### 2.1 系统架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        客户端 (Desktop Client)                       │
│                       Electron + React + TypeScript                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐│
│  │ 窗口管理  │  │ Tiptap   │  │ 状态管理  │  │ 本地缓存层 (Local     ││
│  │ 系统托盘  │  │ 富文本    │  │ Zustand  │  │ Cache — Lite+套餐)  ││
│  │ 快捷键   │  │ 编辑器   │  │          │  │ SQLite (离线模式)     ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘│
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS + WSS (加密传输)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API 网关层 (API Gateway)                      │
│                    Nginx / Kong / Cloudflare                         │
│  限流 · 认证 · 路由 · 负载均衡 · 日志                                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                    后端服务层 (Backend Services)                      │
│                      NestJS / Node.js 微服务                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐│
│  │ 用户服务  │  │ 创作服务  │  │ AI编排   │  │ 记忆系统服务          ││
│  │ · 注册    │  │ · CRUD   │  │ · Prompt │  │ · 向量检索            ││
│  │ · 登录    │  │ · 版本   │  │ · Agent  │  │ · 摘要生成            ││
│  │ · 鉴权    │  │ · 同步   │  │ · SSE流  │  │ · 冲突检测            ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘│
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐│
│  │ 订阅服务  │  │ 导出服务  │  │ 文件服务  │  │ 通知服务              ││
│  │ · 套餐    │  │ · Word   │  │ · 上传    │  │ · WebSocket推送       ││
│  │ · 支付    │  │ · TXT    │  │ · 下载    │  │ · 邮件通知            ││
│  │ · 额度    │  │ · EPUB   │  │ · CDN     │  │                      ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘│
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                       数据层 (Data Layer)                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ PostgreSQL 16    │  │ Redis Cluster     │  │ 对象存储 (OSS)    │  │
│  │ · 业务数据       │  │ · 会话缓存        │  │ · 导出文件        │  │
│  │ · 创作内容       │  │ · 热度数据        │  │ · 用户头像        │  │
│  │ · 用户/订阅      │  │ · 实时协作队列    │  │ · 文风样本        │  │
│  │ · pgvector扩展   │  │ · 限流计数器      │  │ · 备份归档        │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心技术选型说明

#### 2.2.1 桌面框架: Electron

**选型理由**:
- 跨平台：一套代码同时覆盖 Windows 和 macOS
- 生态成熟：npm生态中有丰富的工具和库可用
- 本地能力：完整的文件系统访问、进程管理、系统托盘等
- 自动更新：electron-updater 支持增量更新

**关键依赖**:
```json
{
  "electron": "^28.0.0",
  "electron-builder": "^24.0.0",
  "electron-updater": "^6.0.0"
}
```

#### 2.2.2 前端框架: React + TypeScript + Tailwind CSS

**选型理由**:
- React 组件化体系适合复杂的编辑器界面
- TypeScript 在大型项目中提供类型安全保障
- Tailwind CSS 的 Utility-First 方式能快速构建一致且美观的界面，与 Codex 风格高度兼容

**关键依赖**:
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.3.0",
  "tailwindcss": "^3.4.0",
  "@radix-ui/react-dialog": "对话框组件",
  "@radix-ui/react-dropdown-menu": "下拉菜单组件",
  "@radix-ui/react-tabs": "标签页组件",
  "@radix-ui/react-scroll-area": "滚动区域组件",
  "@radix-ui/react-toast": "消息提示组件",
  "lucide-react": "图标库"
}
```

#### 2.2.3 富文本编辑器: Tiptap

**选型理由**:
- 基于 ProseMirror — 工业级编辑器框架，Schema驱动
- 类Notion块编辑体验
- 支持Markdown快捷键
- 语法高亮扩展
- 完全可控的插件系统

**关键依赖**:
```json
{
  "@tiptap/react": "^2.1.0",
  "@tiptap/starter-kit": "^2.1.0",
  "@tiptap/extension-placeholder": "^2.1.0",
  "@tiptap/extension-code-block-lowlight": "^2.1.0",
  "@tiptap/extension-table": "^2.1.0",
  "@tiptap/extension-highlight": "^2.1.0",
  "@tiptap/extension-collaboration": "^2.1.0"
}
```

#### 2.2.4 后端框架: NestJS + TypeScript

**选型理由**:
- 企业级Node.js框架，模块化架构清晰
- 原生支持TypeScript，与前端类型定义共享
- 内置微服务支持，方便服务拆分
- 丰富的生态（TypeORM、Swagger、Guard等）
- 适合大型项目的长期维护

**关键依赖**:
```json
{
  "@nestjs/core": "^10.3.0",
  "@nestjs/common": "^10.3.0",
  "@nestjs/platform-express": "^10.3.0",
  "@nestjs/platform-socket.io": "^10.3.0",
  "@nestjs/typeorm": "^10.0.0",
  "@nestjs/jwt": "^10.2.0",
  "@nestjs/passport": "^10.0.0",
  "@nestjs/schedule": "^4.0.0",
  "typeorm": "^0.3.19",
  "pg": "^8.11.0",
  "class-validator": "^0.14.0",
  "class-transformer": "^0.5.0"
}
```

> **API版本化**: 在 `main.ts` 中通过 `app.setGlobalPrefix('api/v1')` 设置全局路由前缀，确保所有业务API统一版本化。健康检查端点 `/health` 使用独立控制器，不受前缀影响。

#### 2.2.5 云数据库: PostgreSQL 16 + pgvector

**选型理由**:
- 成熟稳定的关系型数据库，支持百万行级数据的高效查询
- **pgvector 扩展**在同一数据库中提供向量检索能力，无需额外部署向量数据库
- 支持全文搜索、JSON字段、窗口函数等高级特性
- 托管服务成熟（AWS RDS / 阿里云 RDS / Supabase）
- 一库多用：业务数据 + 向量记忆 + 全文索引，降低运维复杂度

**关键依赖**:
```json
{
  "pg": "^8.11.0",
  "pgvector": "^0.1.0",
  "typeorm": "^0.3.19"
}
```

#### 2.2.6 缓存层: Redis

**选型理由**:
- 会话管理（用户登录状态）
- AI生成限流计数（套餐额度管理）
- 热门数据缓存（大纲/设定等高频读取数据）
- 实时协作消息队列

**关键依赖**:
```json
{
  "ioredis": "^5.3.0",
  "@nestjs/bull": "^10.0.0",
  "bullmq": "^5.0.0"
}
```

#### 2.2.7 云存储: 对象存储 (OSS/S3)

**选型理由**:
- 导出文件（Word/TXT/EPUB）存储与CDN分发
- 用户上传的文风样本文件存储
- 定时备份归档
- 用户头像等静态资源

**服务选择**:
| 部署区域 | 推荐服务 |
|---------|---------|
| 中国大陆 | 阿里云 OSS / 腾讯云 COS |
| 海外 | AWS S3 / Cloudflare R2 |

#### 2.2.8 AI接口: OpenAI 兼容 SDK

**选型理由**:
- 兼容 OpenAI / Anthropic / DeepSeek 等主流API
- 原生支持流式输出 (SSE)
- 服务端统一代理，保护用户API Key
- 支持多模型负载均衡与故障切换

**关键依赖**:
```json
{
  "openai": "^4.20.0",
  "@anthropic-ai/sdk": "^0.20.0"
}
```

#### 2.2.9 客户端状态管理: Zustand

**选型理由**:
- 轻量、无模板代码
- 支持TypeScript
- 与React hooks自然集成
- 支持persist中间件（本地缓存层使用）

#### 2.2.10 客户端本地缓存: SQLite (Lite及以上套餐离线模式)

**选型理由**:
- Lite及以上套餐用户下载数据到本地后，使用SQLite作为离线数据库
- 与云端PostgreSQL通过同步协议保持一致
- 联网后自动增量同步

**关键依赖**:
```json
{
  "better-sqlite3": "^9.4.0"
}
```

### 2.3 项目目录结构

```
novel-writing-assistant/
├── client/                         # Electron 桌面客户端
│   ├── electron/                   # Electron 主进程
│   │   ├── main.ts                 # 主进程入口
│   │   ├── preload.ts              # 预加载脚本
│   │   ├── ipc/                    # IPC 通信模块
│   │   │   ├── file.handler.ts     # 本地文件读写 (Lite+套餐)
│   │   │   ├── db.handler.ts       # 本地SQLite操作 (Lite+套餐)
│   │   │   ├── sync.handler.ts     # 云端同步管理
│   │   │   └── ai.handler.ts       # AI请求代理
│   │   ├── services/               # 主进程服务
│   │   │   ├── api-client.service.ts   # 云端API通信
│   │   │   ├── auth.service.ts         # 认证令牌管理
│   │   │   ├── sync.service.ts         # 增量同步服务
│   │   │   ├── offline.service.ts      # 离线模式管理
│   │   │   ├── local-db.service.ts     # 本地SQLite管理
│   │   │   ├── autosave.service.ts     # 自动保存（云端+本地）
│   │   │   └── update.service.ts       # 自动更新
│   │   └── utils/
│   ├── src/                        # 渲染进程 (React)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/             # 通用组件
│   │   │   ├── layout/             # 布局组件
│   │   │   │   ├── AppShell.tsx
│   │   │   │   ├── TopNavbar.tsx
│   │   │   │   ├── LeftSidebar.tsx
│   │   │   │   └── RightPanel.tsx
│   │   │   ├── editor/             # 编辑器组件
│   │   │   │   ├── RichEditor.tsx
│   │   │   │   ├── EditorToolbar.tsx
│   │   │   │   └── FloatingMenu.tsx
│   │   │   ├── version/            # Git版本管理组件
│   │   │   │   ├── VersionHistory.tsx     # 版本历史列表
│   │   │   │   ├── VersionDiff.tsx        # 版本差异对比视图
│   │   │   │   ├── BranchManager.tsx      # 分支管理面板
│   │   │   │   └── VersionRevertDialog.tsx # 版本回退确认对话框
│   │   │   ├── ai/                 # AI交互组件
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   ├── StreamingText.tsx
│   │   │   │   └── GenerationControls.tsx
│   │   │   ├── outline/            # 大纲/纲树组件
│   │   │   │   ├── OutlineTree.tsx
│   │   │   │   ├── OutlineEditor.tsx
│   │   │   │   └── OutlineSync.tsx
│   │   │   ├── characters/         # 角色管理组件
│   │   │   │   ├── CharacterList.tsx
│   │   │   │   ├── CharacterProfile.tsx
│   │   │   │   └── RelationshipGraph.tsx
│   │   │   ├── worldbuilding/      # 世界观组件
│   │   │   ├── settings/           # 设置组件
│   │   │   └── subscription/       # 订阅管理组件
│   │   │       ├── PricingPage.tsx
│   │   │       └── UsageDashboard.tsx
│   │   ├── stores/                 # 状态管理
│   │   │   ├── auth.store.ts
│   │   │   ├── project.store.ts
│   │   │   ├── editor.store.ts
│   │   │   ├── outline.store.ts
│   │   │   ├── character.store.ts
│   │   │   ├── worldbuilding.store.ts
│   │   │   ├── memory.store.ts
│   │   │   ├── subscription.store.ts
│   │   │   ├── token.store.ts
│   │   │   ├── sync.store.ts
│   │   │   ├── version.store.ts    # 云端版本状态
│   │   │   ├── notification.store.ts
│   │   │   └── ai.store.ts
│   │   ├── hooks/                  # 自定义Hooks
│   │   ├── services/               # 前端服务层
│   │   │   ├── api.service.ts      # 通用HTTP客户端
│   │   │   ├── auth.service.ts     # 认证服务
│   │   │   ├── book.service.ts     # 书籍/卷/章节 API
│   │   │   ├── outline.service.ts  # 大纲 API
│   │   │   ├── character.service.ts # 角色 API
│   │   │   ├── worldbuilding.service.ts # 世界观 API
│   │   │   ├── memory.service.ts   # 记忆检索 API
│   │   │   ├── token.service.ts    # Token购买/余额 API
│   │   │   ├── subscription.service.ts # 订阅 API
│   │   │   ├── sync.service.ts     # 同步服务
│   │   │   ├── prompt.service.ts   # Prompt模板引擎
│   │   │   ├── version.service.ts  # 云端版本管理 API
│   │   │   └── export.service.ts   # 导出服务
│   │   ├── types/                  # 客户端专属类型（通用类型从 shared/ 导入）
│   │   │   ├── editor.types.ts     # 编辑器状态类型
│   │   │   ├── electron.types.ts   # Electron IPC 通道类型
│   │   │   └── theme.types.ts      # 主题配置类型
│   │   └── utils/
│   ├── resources/                  # 静态资源
│   │   ├── icons/
│   │   └── themes/
│   ├── electron-builder.yml
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── server/                         # 后端服务 (NestJS)
│   ├── src/
│   │   ├── main.ts                 # 服务入口
│   │   ├── app.module.ts           # 根模块
│   │   ├── config/                 # 配置管理
│   │   │   ├── database.config.ts
│   │   │   ├── redis.config.ts
│   │   │   ├── oss.config.ts
│   │   │   └── ai.config.ts
│   │   ├── modules/
│   │   │   ├── auth/               # 认证模块
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.guard.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── dto/
│   │   │   ├── user/               # 用户模块
│   │   │   │   ├── user.controller.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   ├── user.entity.ts
│   │   │   │   └── dto/
│   │   │   ├── subscription/       # 订阅模块
│   │   │   │   ├── subscription.controller.ts
│   │   │   │   ├── subscription.service.ts
│   │   │   │   ├── subscription.entity.ts
│   │   │   │   ├── payment.service.ts
│   │   │   │   └── usage.service.ts
│   │   │   ├── project/            # 创作项目管理
│   │   │   │   ├── book.controller.ts
│   │   │   │   ├── book.service.ts
│   │   │   │   ├── book.entity.ts
│   │   │   │   ├── volume.entity.ts
│   │   │   │   ├── chapter.controller.ts
│   │   │   │   ├── chapter.service.ts
│   │   │   │   └── chapter.entity.ts
│   │   │   ├── outline/            # 大纲系统 ✅ 完整
│   │   │   │   ├── outline.controller.ts
│   │   │   │   ├── outline.service.ts
│   │   │   │   ├── outline.module.ts
│   │   │   │   └── entities/outline.entity.ts
│   │   │   ├── character/          # 角色系统 ✅ 完整
│   │   │   │   ├── character.controller.ts
│   │   │   │   ├── character.service.ts
│   │   │   │   ├── character.module.ts
│   │   │   │   └── entities/
│   │   │   │       ├── character.entity.ts
│   │   │   │       └── character-relation.entity.ts
│   │   │   ├── worldbuilding/      # 世界观系统 ✅ 完整
│   │   │   │   ├── worldbuilding.controller.ts
│   │   │   │   ├── worldbuilding.service.ts
│   │   │   │   ├── worldbuilding.module.ts
│   │   │   │   └── entities/world-setting.entity.ts
│   │   │   ├── ai/                 # AI编排模块 ✅ 完整
│   │   │   │   ├── ai.controller.ts
│   │   │   │   ├── ai.service.ts
│   │   │   │   ├── ai.module.ts
│   │   │   │   ├── prompt-template.service.ts
│   │   │   │   ├── streaming.service.ts
│   │   │   │   ├── model-router.service.ts
│   │   │   │   └── agents/
│   │   │   │       ├── agents.module.ts
│   │   │   │       ├── agents.controller.ts
│   │   │   │       ├── base.agent.ts
│   │   │   │       ├── orchestrator.service.ts
│   │   │   │       ├── architect.agent.ts
│   │   │   │       ├── character-designer.agent.ts
│   │   │   │       ├── world-builder.agent.ts
│   │   │   │       ├── style-mimic.agent.ts
│   │   │   │       ├── quality-inspector.agent.ts
│   │   │   │       └── dehumanize.service.ts
│   │   │   ├── memory/             # 记忆系统模块 ✅ 完整
│   │   │   │   ├── memory.controller.ts
│   │   │   │   ├── memory.service.ts
│   │   │   │   ├── memory.module.ts
│   │   │   │   ├── memory-extraction.service.ts
│   │   │   │   ├── embedding.service.ts
│   │   │   │   ├── vector-search.service.ts
│   │   │   │   ├── conflict-detector.service.ts
│   │   │   │   └── entities/
│   │   │   │       ├── memory-event.entity.ts
│   │   │   │       ├── foreshadow.entity.ts
│   │   │   │       ├── character-state.entity.ts
│   │   │   │       ├── setting-patch.entity.ts
│   │   │   │       ├── style-anchor.entity.ts
│   │   │   │       └── subplot-thread.entity.ts
│   │   │   ├── sync/               # 数据同步模块 ⚠️ 部分完成
│   │   │   │   ├── sync.module.ts
│   │   │   │   ├── sync.controller.ts
│   │   │   │   ├── sync.service.ts
│   │   │   │   ├── conflict-resolver.service.ts
│   │   │   │   └── entities/operation-log.entity.ts
│   │   │   ├── version/            # 云端版本管理 ✅ 完整
│   │   │   │   ├── version.module.ts
│   │   │   │   ├── version.controller.ts
│   │   │   │   ├── version.service.ts
│   │   │   │   └── entities/chapter-version.entity.ts
│   │   │   ├── export/             # 导出服务模块 ⚠️ 部分完成
│   │   │   │   ├── export.module.ts
│   │   │   │   ├── export.controller.ts
│   │   │   │   └── export.service.ts
│   │   │   ├── token/              # Token系统 ✅ 完整
│   │   │   │   ├── token.module.ts
│   │   │   │   ├── token.controller.ts
│   │   │   │   ├── token.service.ts
│   │   │   │   └── entities/
│   │   │   │       ├── token-balance.entity.ts
│   │   │   │       ├── token-package.entity.ts
│   │   │   │       └── token-transaction.entity.ts
│   │   │   ├── cache/              # 缓存模块 ✅ 完整
│   │   │   │   ├── cache.module.ts
│   │   │   │   └── cache.service.ts
│   │   │   └── health/             # 健康检查 ✅ 完整
│   │   │       ├── health.module.ts
│   │   │       └── health.controller.ts
│   │   ├── common/                 # 公共能力
│   │   │   ├── decorators/
│   │   │   ├── filters/
│   │   │   ├── interceptors/
│   │   │   ├── guards/
│   │   │   └── pipes/
│   │   ├── modules/
│   │   │   ├── health/             # 健康检查模块 ✅ 完整
│   │   │   │   ├── health.module.ts
│   │   │   │   └── health.controller.ts
│   │   │   ├── cache/              # 缓存模块 ✅ 完整
│   │   │   │   ├── cache.module.ts
│   │   │   │   └── cache.service.ts
│   │   │   ├── audit/              # 🔧 审计日志（计划中）
│   │   │   ├── event-bus/          # 🔧 事件总线（计划中）
│   │   │   └── rate-limit/         # 🔧 限流（计划中）
│   │   │   ├── file/               # 🔧 文件管理（计划中）
│   │   │   └── notification/       # 🔧 通知模块（计划中）
│   │   └── migrations/             # 数据库迁移
│   ├── test/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                         # 前后端共享类型定义（单一真相源）
│   ├── types/
│   │   ├── api.types.ts            # 通用API请求/响应格式 + 分页
│   │   ├── user.types.ts           # 用户信息 + 认证载荷 + 权限
│   │   ├── project.types.ts        # Book/Volume/Chapter 接口类型
│   │   ├── outline.types.ts        # Outline 树形结构类型
│   │   ├── character.types.ts      # Character + Relation + CharacterState
│   │   ├── worldbuilding.types.ts  # WorldSetting 类型
│   │   ├── memory.types.ts         # Event/Foreshadow/SettingPatch/StyleAnchor
│   │   ├── ai.types.ts             # AI请求/SSE事件/生成结果/去味审查
│   │   ├── token.types.ts          # TokenPackage/Balance/Purchase/Transaction
│   │   ├── subscription.types.ts   # Plan/Subscription/Payment 类型
│   │   ├── sync.types.ts           # 同步协议 + OperationLog 类型
│   │   ├── version.types.ts        # 版本快照 + 差异对比类型
│   │   ├── notification.types.ts   # 通知类型
│   │   ├── error.types.ts          # 统一错误码枚举 + ErrorResponse格式
│   │   ├── event.types.ts          # 系统事件枚举 + 事件载荷类型
│   │   └── ws.types.ts             # WebSocket 客户端/服务端事件枚举
│   └── constants/
│       ├── limits.ts               # 套餐限制常量
│       └── error-codes.ts          # 错误码定义
│
├── docker-compose.yml              # 本地开发环境编排
├── package.json                    # Monorepo根配置
└── pnpm-workspace.yaml
```

### 2.4 云端版本管理系统

#### 2.4.1 设计目标

在**服务端**实现类 Git 的版本管理能力——比 Git 更简单，无需分支/tag等复杂概念，专注核心场景：

- **自动版本快照**: 每次 AI 生成完成、用户手动保存时，自动在云端创建版本快照
- **版本回退**: 支持将任意章节回退到任一历史版本（一键恢复）
- **差异对比**: 可视化展示当前版本与历史版本之间的文本差异
- **唯一本地交互**: 用户可将整本书籍数据从云端下载到本地（已有功能，参见 3.5 节离线模式）；下载后本地不维护版本历史，版本管理完全在云端

#### 2.4.2 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                   版本管理全流程（云端）                        │
│                                                              │
│  客户端                         服务端                         │
│  ┌──────────────┐     POST     ┌──────────────────────────┐ │
│  │ 编辑器保存    │ ──────────▶  │ version.service          │ │
│  │ (手动/自动)  │              │ · 创建版本快照            │ │
│  └──────────────┘              │ · 存储到 chapter_versions │ │
│                                │ · 套餐额度校验            │ │
│  ┌──────────────┐     GET      └──────────────────────────┘ │
│  │ 版本历史面板  │ ◀──────────                                  │
│  └──────────────┘              ┌──────────────────────────┐ │
│                                │ version.controller       │ │
│  ┌──────────────┐     GET      │ · GET /versions/:bookId  │ │
│  │ 差异对比视图  │ ◀──────────  │ · GET /versions/:id/diff │ │
│  └──────────────┘              │ · POST /versions/:id/    │ │
│                                │       revert             │ │
│  ┌──────────────┐     POST     │ · DELETE /versions/:id   │ │
│  │ 回退确认     │ ──────────▶  └──────────────────────────┘ │
│  └──────────────┘                                           │
│                                                              │
│  唯一本地操作: 下载整本书籍到本地（已有 3.5 节离线模式）       │
│  本地无版本历史，所有版本数据仅在云端                          │
└──────────────────────────────────────────────────────────────┘
```

#### 2.4.3 数据模型

详见 [6.1.2 核心创作表 — 版本管理](#612-核心创作表)，`chapter_versions` 表包含版本快照所需全部字段：`content`、`content_preview`、`word_count`、`word_diff`、`label`、`source`、`diff_with_previous` 等。以下为本节所需的索引补充：
CREATE INDEX idx_versions_chapter ON chapter_versions(chapter_id, version_number DESC);
CREATE INDEX idx_versions_book ON chapter_versions(book_id, created_at DESC);
CREATE INDEX idx_versions_source ON chapter_versions(book_id, source);
```

**版本保留策略**（按套餐）:

| 套餐 | 每章节保留版本数 | 超过后的处理 |
|------|----------------|------------|
| Free | 3个 | 删除最早版本（保留首版+最新2版） |
| Lite | 10个 | 合并中间版本（保留首版+最新N-1版） |
| Basic | 30个 | 合并中间版本 |
| Plus | 100个 | 合并中间版本 |
| Pro | 无限制 | 不删除 |

> **注意**: "保留首版"指始终保留AI生成的初始版本（version_number=1），以便用户随时回退到最初的AI输出。

#### 2.4.4 自动快照策略

| 触发时机 | source 字段 | 说明 |
|---------|-----------|------|
| AI 生成章节完成 | `ai_generate` | SSE流式结束后自动创建，label默认"AI初稿" |
| 用户手动保存 (Ctrl+S) | `manual_save` | 含变更字数差异 |
| 自动保存 (空闲60秒) | `auto_save` | 静默创建，不触发通知 |
| AI 去味审查后接受修改 | `review_dehumanize` | 同时记录去味前后的AI味指数变化 |
| 版本回退操作 | `revert` | 回退前自动保存当前版本（防止误操作） |
| 用户导入已有作品 | `import` | 初始版本 |

**防抖策略**:
- 连续自动保存（<60秒内多次）只保留最后一次，中间版本不创建
- AI流式生成过程中不创建版本，只在生成完成时创建
- 用户手动保存始终创建版本（不防抖）

#### 2.4.5 后端 API 设计

```
# 版本历史
GET    /api/v1/books/:bookId/chapters/:chapterId/versions
       ?page=1&limit=20&source=ai_generate
       → { versions: VersionInfo[], total: number }

GET    /api/v1/versions/:versionId
       → { version: VersionDetail }          # 获取某版本完整内容

# 差异对比
GET    /api/v1/versions/diff
       ?left=:versionId1&right=:versionId2
       → { diff: DiffResult }                # 两个版本之间的差异

GET    /api/v1/chapters/:chapterId/diff-current
       ?compareWith=:versionId
       → { diff: DiffResult }                # 历史版本 vs 当前内容

# 版本回退
POST   /api/v1/versions/:versionId/revert
       → 将章节内容回退到指定版本
       → 回退前自动创建当前版本的快照（source=revert）
       → 返回回退后的章节内容

# 版本标签
PATCH  /api/v1/versions/:versionId/label
       body: { label: "定稿" }
       → 给版本添加/修改标签

# 版本删除（手动删除不需要的中间版本）
DELETE /api/v1/versions/:versionId
       → 不能删除首版(version_number=1)和最新版
```

```typescript
// shared/types/version.types.ts

interface VersionInfo {
  id: string;                    // 版本ID (UUID)
  versionNumber: number;         // 版本序号
  contentPreview: string;        // 前200字预览
  wordCount: number;
  wordDiff: number;              // 与上一版的字数差异
  label: string | null;
  source: VersionSource;
  createdAt: string;
}

type VersionSource =
  | 'ai_generate'
  | 'manual_save'
  | 'auto_save'
  | 'review_dehumanize'
  | 'revert'
  | 'import';

interface VersionDetail extends VersionInfo {
  content: string;               // 完整文本（仅在请求单个版本时返回）
}

interface DiffResult {
  leftVersion: { id: string; versionNumber: number; createdAt: string };
  rightVersion: { id: string; versionNumber: number; createdAt: string };
  stats: {
    additions: number;           // 新增行数
    deletions: number;           // 删除行数
    unchangedLines: number;
    totalChanges: number;        // 变更块数量
  };
  hunks: DiffHunk[];             // 差异块（供前 Monaco diff 使用）
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: Array<{
    type: 'equal' | 'add' | 'delete';
    text: string;
  }>;
}
```

#### 2.4.6 后端服务实现

```typescript
// server/src/modules/version/version.service.ts

@Injectable()
export class VersionService {
  /**
   * 创建版本快照
   * 调用时机: AI生成完成、用户保存、去味审查接受
   */
  async createSnapshot(params: CreateVersionDto): Promise<VersionInfo> {
    const { chapterId, content, source, label } = params;

    // 1. 获取当前章节信息
    const chapter = await this.chapterRepo.findOne({ where: { id: chapterId } });

    // 2. 计算与上一版本的差异
    const lastVersion = await this.versionRepo.findOne({
      where: { chapterId },
      order: { versionNumber: 'DESC' },
    });

    const wordDiff = lastVersion ? content.length - lastVersion.content.length : 0;
    const diffText = lastVersion
      ? this.computeUnifiedDiff(lastVersion.content, content)
      : null;
    const contentPreview = content.slice(0, 200);

    // 3. 创建新版本
    const newVersion = this.versionRepo.create({
      chapterId,
      bookId: chapter.bookId,
      userId: chapter.userId,
      versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
      content,
      contentPreview,
      wordCount: content.length,
      wordDiff,
      label,
      source,
      diffWithPrevious: diffText,
    });

    await this.versionRepo.save(newVersion);

    // 4. 检查并执行版本保留策略（超出套餐限额则清理旧版本）
    await this.enforceRetentionPolicy(chapter.bookId, chapterId);

    return this.toVersionInfo(newVersion);
  }

  /**
   * 版本回退
   */
  async revertToVersion(versionId: string): Promise<RevertResult> {
    const targetVersion = await this.versionRepo.findOne({ where: { id: versionId } });
    const chapter = await this.chapterRepo.findOne({ where: { id: targetVersion.chapterId } });

    // 1. 回退前保存当前版本（防止误操作）
    await this.createSnapshot({
      chapterId: chapter.id,
      content: chapter.content,
      source: 'revert',
      label: `回退到v${targetVersion.versionNumber}前自动保存`,
    });

    // 2. 更新章节内容为目标版本
    chapter.content = targetVersion.content;
    chapter.wordCount = targetVersion.wordCount;
    chapter.syncVersion += 1;
    await this.chapterRepo.save(chapter);

    // 3. 发布事件（通知WebSocket推送）
    this.eventBus.publish({
      type: 'chapter.reverted',
      payload: { chapterId: chapter.id, versionId, versionNumber: targetVersion.versionNumber },
    });

    return { chapterId: chapter.id, content: targetVersion.content, revertedToVersion: targetVersion.versionNumber };
  }

  /**
   * 套餐版本保留策略
   */
  private async enforceRetentionPolicy(bookId: string, chapterId: string): Promise<void> {
    const user = await this.getBookOwner(bookId);
    const maxVersions = SUBSCRIPTION_LIMITS[user.tier].versionHistoryLimit;

    if (maxVersions === -1) return; // Pro无限制

    const total = await this.versionRepo.count({ where: { chapterId } });

    if (total <= maxVersions) return;

    // 删除最早的版本，但保留首版(v1)和最新版
    const toDelete = total - maxVersions;
    const oldVersions = await this.versionRepo.find({
      where: { chapterId },
      order: { versionNumber: 'ASC' },
      skip: 1,  // 跳过v1
      take: toDelete,
    });

    await this.versionRepo.remove(oldVersions);
  }

  /**
   * 使用 diff-match-patch 生成中文友好的差异文本
   */
  private computeUnifiedDiff(oldText: string, newText: string): string {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(diffs);
    return dmp.diff_toDelta(diffs);  // 紧凑格式存储
  }
}
```

```typescript
// server/src/modules/version/version.module.ts

@Module({
  imports: [
    TypeOrmModule.forFeature([ChapterVersion, Chapter, Book]),
    EventBusModule,
  ],
  controllers: [VersionController],
  providers: [VersionService],
  exports: [VersionService],
})
export class VersionModule {}
```

#### 2.4.7 前端组件设计

**组件清单**:

| 组件 | 文件 | 功能 |
|------|------|------|
| VersionHistory | `version/VersionHistory.tsx` | 版本时间线列表，按时间倒序展示所有快照 |
| VersionDiff | `version/VersionDiff.tsx` | Monaco diff editor 对比两个版本 |
| VersionRevertDialog | `version/VersionRevertDialog.tsx` | 回退确认弹窗 |

```
┌──────────────────────────────────────────────────────────────┐
│                    版本历史面板 (VersionHistory)                │
├──────────────────────────────────────────────────────────────┤
│ 📋 第52章: 破境之战  版本历史      来源筛选: [全部 ▼]        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  v7  📝 定稿                        2分钟前   [手动保存]      │
│      📄 3,120字  (+42字)                                    │
│      [对比当前] [回退] [标签]                                 │
│                                                              │
│  v6  🤖 AI初稿                      15分钟前  [去味审查]      │
│      📄 3,078字  (+156字)  AI味指数: 32→18                  │
│      [对比当前] [回退] [标签]                                 │
│                                                              │
│  v5  🤖 AI初稿                      1小时前   [AI生成]       │
│      📄 2,922字  (+2,980字)  AI味指数: 72                   │
│      [对比当前] [回退] [标签]                                 │
│                                                              │
│  v4  📝 编辑中                      2小时前   [手动保存]      │
│  v3  📝 编辑中                      昨天      [手动保存]      │
│  v2  💾 自动保存                     昨天      [自动保存]      │
│  v1  🤖 AI初稿                      昨天      [AI生成]       │
│      📄 2,850字                                             │
│      [对比当前] [回退] [标签]                                 │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ ℹ 已使用 7 / 30 个版本 (Basic套餐)                           │
└──────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────┐
│                 版本差异对比视图 (VersionDiff)                   │
├──────────────────────────────────────────────────────────────┤
│  对比: [当前版本 v7]  vs  [v5 AI生成 (2026-06-08 14:30) ▼]  │
├────────────────────────┬─────────────────────────────────────┤
│  当前版本 v7 (最新)     │  历史版本 v5 (AI生成)               │
│                        │                                     │
│  陈凡踏入天道殿，殿中   │  陈凡踏入天道殿，便看见殿中已经      │
│  已有三位强者——       │  有了三位强者等候在此。这三位      │
│  他们分别代表了...     │  强者分别代表了...                  │
│                        │                                     │
│  + 其中一位身着白袍，  │                                     │
│  + 面容清冷如霜，正是  │                                     │
│  + 传说中早已陨落的    │                                     │
│  + 北冥仙尊。         │                                     │
│                        │                                     │
│  这让陈凡心头一凛。    │  陈凡心想这些人的实力恐怕都在      │
│                        │  自己之上。                         │
│                        │                                     │
│  - 陈凡心想这些人的    │                                     │
│  - 实力恐怕都在自己    │                                     │
│  - 之上。              │                                     │
│                        │                                     │
├────────────────────────┴─────────────────────────────────────┤
│ 统计: +4行  -3行  共2处变更                 [回退到v5版本]   │
└──────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────┐
│               版本回退确认对话框 (VersionRevertDialog)           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚠ 确认将第52章回退到 v5 (AI生成版本)?                        │
│                                                              │
│  回退后此章将恢复到第5版的内容，当前修改将被丢弃。              │
│  (回退前会自动保存当前版本，不会丢失数据)                       │
│                                                              │
│  即将丢失的变更:                                              │
│  · v6: 去味润色 (+156字)                                     │
│  · v7: 手动编辑 (+42字)                                      │
│                                                              │
│  [查看差异详情]              [取消]  [确认回退]               │
└──────────────────────────────────────────────────────────────┘
```

#### 2.4.8 前端 Store 与服务

```typescript
// client/src/stores/version.store.ts

interface VersionState {
  // 版本列表
  versions: VersionInfo[];
  totalVersions: number;
  historyLoading: boolean;

  // 差异对比
  diffLeftVersionId: string | null;
  diffRightVersionId: string | null;
  diffResult: DiffResult | null;
  diffLoading: boolean;

  // 回退
  revertTarget: VersionInfo | null;
  showRevertDialog: boolean;
  revertInProgress: boolean;

  // 面板控制
  showVersionPanel: boolean;
  showDiffPanel: boolean;
}
```

```typescript
// client/src/services/version.service.ts

class VersionService {
  async getVersionHistory(chapterId: string, params?: {
    page?: number;
    limit?: number;
    source?: VersionSource;
  }): Promise<{ versions: VersionInfo[]; total: number }>;

  async getVersionDetail(versionId: string): Promise<VersionDetail>;

  async compareVersions(leftVersionId: string, rightVersionId: string): Promise<DiffResult>;

  async compareWithCurrent(chapterId: string, compareVersionId: string): Promise<DiffResult>;

  async revertToVersion(versionId: string): Promise<{ content: string; revertedToVersion: number }>;

  async updateLabel(versionId: string, label: string): Promise<void>;

  async deleteVersion(versionId: string): Promise<void>;
}
```

#### 2.4.9 依赖补充

```json
// client/package.json
{
  "@monaco-editor/react": "^4.6.0"   // diff编辑器
}

// server/package.json
{
  "diff-match-patch": "^1.0.5"       // 文本差异算法（服务端预计算diff）
}
```

#### 2.4.10 与本地数据下载的关系

> 版本管理**完全在云端**。用户通过已有的**数据下载功能**（参见 3.5 节，Lite+套餐）可将书籍完整数据下载到本地 SQLite。下载到本地后：
> - 本地仅有**最新版本**的章节内容
> - 如需回退历史版本，需联网从云端拉取
> - 离线模式下不支持版本回退（无历史数据）
> - 联网后版本管理功能恢复正常



---

## 3. 用户与订阅系统

### 3.1 用户认证架构

```
┌─────────────────────────────────────────────────────────────┐
│                       认证流程                                │
│                                                             │
│   客户端                    服务端                    数据库    │
│     │                        │                        │      │
│     │  POST /auth/register   │                        │      │
│     │ ──────────────────────▶│  bcrypt(password)       │      │
│     │                        │ ──────────────────────▶│      │
│     │                        │  user created           │      │
│     │  { user, accessToken } │ ◀──────────────────────│      │
│     │ ◀──────────────────────│                        │      │
│     │                        │                        │      │
│     │  POST /auth/login      │                        │      │
│     │ ──────────────────────▶│  verify password        │      │
│     │                        │  sign JWT              │      │
│     │  { accessToken,        │  store in Redis        │      │
│     │    refreshToken }      │                        │      │
│     │ ◀──────────────────────│                        │      │
│     │                        │                        │      │
│     │  所有后续请求 Header:   │                        │      │
│     │  Authorization: Bearer │  JWT Guard             │      │
│     │  ──────────────────────▶│  verify + check Redis  │      │
│     │                        │  attach user to req    │      │
│     │                        │                        │      │
│     │  POST /auth/refresh    │                        │      │
│     │  { refreshToken }      │  rotate tokens         │      │
│     │ ──────────────────────▶│                        │      │
│     │  { new accessToken }   │                        │      │
│     │ ◀──────────────────────│                        │      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 认证实现

```typescript
// JWT Token 载荷
interface JwtPayload {
  sub: string;           // 用户ID
  email: string;         // 用户邮箱
  plan: SubscriptionTier; // 当前套餐等级
  iat: number;           // 签发时间
  exp: number;           // 过期时间
}

// 认证API端点
// POST   /api/v1/auth/register     — 邮箱注册
// POST   /api/v1/auth/login        — 邮箱密码登录
// POST   /api/v1/auth/login/oauth  — OAuth登录 (Google/微信/GitHub)
// POST   /api/v1/auth/refresh      — 刷新令牌
// POST   /api/v1/auth/logout       — 登出（废弃令牌）
// POST   /api/v1/auth/verify-email — 邮箱验证
// POST   /api/v1/auth/reset-password — 重置密码
```

**安全措施**:
- 密码使用 bcrypt (cost=12) 哈希存储
- JWT Access Token 有效期 15分钟，Refresh Token 有效期 30天
- Refresh Token 轮换机制（每次刷新同时发放新的 Refresh Token）
- 登录失败限流：同一IP 5次/10分钟
- 敏感操作（修改密码、更换邮箱）需要二次验证

### 3.3 订阅系统

#### 3.3.1 套餐定义

```typescript
enum SubscriptionTier {
  FREE = 'free',       // 免费版
  LITE = 'lite',       // 轻量版
  BASIC = 'basic',     // 基础版
  PLUS = 'plus',       // 增强版
  PRO = 'pro',         // 专业版
}

enum ModelType {
  FLASH = 'flash',     // 轻量快速模型 — 成本低、速度快
  PRO = 'pro',         // 旗舰深度模型 — 质量高、风格精准
}

interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  price: number;           // 月费（人民币，单位：分）
  features: PlanFeatures;
}

interface PlanFeatures {
  totalWordLimit: number;            // 字数额度（字）
  workStorageSlots: number;          // 作品存储空间数量
  monthlyTokenQuota: number;         // 每月免费Token额度
  modelType: ModelType;              // 可用模型类型
  parallelSlots: number;             // 并行生成槽位数
  offlineMode: boolean;              // 是否支持数据下载和离线模式
  aiDehumanizeReview: boolean;       // 是否支持AI去味审查
  agentAccess: string[];             // 可用Agent列表
  customStyleLimit: number;          // 文风自定义上限（0=仅预设, -1=无限制）
  versionHistoryLimit: number;       // 版本历史保留数（-1=无限制）
  tokenPurchaseEnabled: boolean;     // 是否可购买Token增量包
  apiAccess: boolean;                // API接入权限
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
}

// 套餐配置实例
const SUBSCRIPTION_PLANS: Record<SubscriptionTier, PlanFeatures> = {
  [SubscriptionTier.FREE]: {
    totalWordLimit: 200_000,
    workStorageSlots: 1,
    monthlyTokenQuota: 200_000,
    modelType: ModelType.FLASH,
    parallelSlots: 1,
    offlineMode: false,
    aiDehumanizeReview: false,
    agentAccess: [],
    customStyleLimit: 3,              // 仅3种预设风格
    versionHistoryLimit: 3,
    tokenPurchaseEnabled: true,
    apiAccess: false,
    supportLevel: 'community',
  },
  [SubscriptionTier.LITE]: {
    totalWordLimit: 500_000,
    workStorageSlots: 3,
    monthlyTokenQuota: 500_000,
    modelType: ModelType.FLASH,
    parallelSlots: 3,
    offlineMode: true,
    aiDehumanizeReview: false,
    agentAccess: ['architect'],
    customStyleLimit: 10,             // 10种预设风格
    versionHistoryLimit: 10,
    tokenPurchaseEnabled: true,
    apiAccess: false,
    supportLevel: 'email',
  },
  [SubscriptionTier.BASIC]: {
    totalWordLimit: 1_000_000,
    workStorageSlots: 5,
    monthlyTokenQuota: 1_000_000,
    modelType: ModelType.PRO,
    parallelSlots: 5,
    offlineMode: true,
    aiDehumanizeReview: true,
    agentAccess: ['architect', 'character-designer', 'quality-inspector'],
    customStyleLimit: 1,              // 可上传1本参考作品
    versionHistoryLimit: 30,
    tokenPurchaseEnabled: true,
    apiAccess: false,
    supportLevel: 'email',
  },
  [SubscriptionTier.PLUS]: {
    totalWordLimit: 2_000_000,
    workStorageSlots: 7,
    monthlyTokenQuota: 2_000_000,
    modelType: ModelType.PRO,
    parallelSlots: 7,
    offlineMode: true,
    aiDehumanizeReview: true,
    agentAccess: ['architect', 'character-designer', 'world-builder', 'quality-inspector'],
    customStyleLimit: 5,              // 可上传5本参考作品，支持混合风格
    versionHistoryLimit: 100,
    tokenPurchaseEnabled: true,
    apiAccess: false,
    supportLevel: 'priority',
  },
  [SubscriptionTier.PRO]: {
    totalWordLimit: 5_000_000,
    workStorageSlots: 15,
    monthlyTokenQuota: 5_000_000,
    modelType: ModelType.PRO,
    parallelSlots: 9,
    offlineMode: true,
    aiDehumanizeReview: true,
    agentAccess: ['*'],               // 全部Agent
    customStyleLimit: -1,             // 无限制
    versionHistoryLimit: -1,          // 无限制
    tokenPurchaseEnabled: true,
    apiAccess: true,
    supportLevel: 'dedicated',
  },
};
```

#### 3.3.2 Token用量追踪与空间管理

```typescript
// Redis中存储的用户当月用量（高频读写）
interface MonthlyTokenUsage {
  userId: string;
  yearMonth: string;           // YYYY-MM
  quotaTokensUsed: number;     // 当月已使用套餐内Token数
  purchasedTokensUsed: number; // 当月已使用增量包Token数
  purchasedTokensRemaining: number; // 增量包剩余Token数（滚存）
}

// 用户累计使用情况 (PostgreSQL)
interface UserUsage {
  userId: string;
  totalWordsGenerated: number;  // 累计已生成字数
  currentWorkSlotsUsed: number; // 当前已占用的作品空间数
}

// Token消耗规则
// 1字正文 ≈ 1.5 Token（含Prompt上下文消耗）
// 例如生成3000字章节，实际消耗约4500 Token
// 每月1日零点重置 quotaTokensUsed，增量包Token不受月度影响

// 用量检查逻辑
// 1. AI生成请求时:
//    a. 检查 quotaTokensUsed < planFeatures.monthlyTokenQuota → 使用套餐额度
//    b. 套餐额度耗尽 → 检查 purchasedTokensRemaining > 0 → 使用增量包
//    c. 增量包也耗尽 → 拒绝请求，提示购买Token增量包
//    d. 检查 totalWordsGenerated < planFeatures.totalWordLimit
// 2. 创建新作品时:
//    a. 检查 currentWorkSlotsUsed < planFeatures.workStorageSlots
//    b. 空间已满 → 提示清空已有作品
// 3. 每月1日:
//    a. quotaTokensUsed 归零
//    b. purchasedTokensRemaining 不变（增量包永不过期）
```


#### 3.3.3 支付集成

| 支付渠道 | 适用场景 | 说明 |
|---------|---------|------|
| **支付宝** | 中国大陆 | 网页支付 / 小程序 |
| **微信支付** | 中国大陆 | 扫码支付 / JSAPI |
| **Stripe** | 海外 | 信用卡 / Apple Pay / Google Pay |

**订阅API端点**:
```
GET    /api/v1/subscription/plans        — 获取所有套餐信息
GET    /api/v1/subscription/current      — 获取当前用户套餐
POST   /api/v1/subscription/subscribe    — 订阅/升级套餐
POST   /api/v1/subscription/cancel       — 取消自动续费
POST   /api/v1/subscription/resume       — 恢复订阅
GET    /api/v1/subscription/invoices     — 获取账单历史
GET    /api/v1/subscription/usage        — 获取用量统计
POST   /api/v1/subscription/webhook      — 支付回调 (支付宝/微信/Stripe)
```

### 3.4 Token购买系统

#### 3.4.1 设计原则

Token是AI生成消耗的计量单位。套餐内的月度Token额度用完后，所有等级用户均可购买Token增量包继续使用AI功能，不受月度限制。

```
Token消耗示意:
  生成3000字正文 ≈ 消耗4500 Token（含Prompt上下文、记忆检索、风格注入等）
  Token消耗 = 输出Token + 输入Token（上下文中的Prompt、记忆、章纲等）
```

#### 3.4.2 Token增量包定价

| 增量包 | 价格 | Token数量 | 约合字数 | 有效期 |
|--------|------|----------|---------|--------|
| **小额包** | ¥9 | 5万 Token | ~3.3万字 | 永久有效 |
| **标准包** | ¥29 | 20万 Token | ~13万字 | 永久有效 |
| **大额包** | ¥79 | 60万 Token | ~40万字 | 永久有效 |
| **超大包** | ¥199 | 200万 Token | ~133万字 | 永久有效 |

> **定价策略**: 大额包折扣更大，鼓励批量购买。Token永久有效，不会按月清零。

#### 3.4.3 Token购买流程

```
用户点击购买Token
    │
    ▼
┌──────────────────────┐
│ 选择增量包            │
│ ┌────┐┌────┐┌────┐  │
│ │ ¥9 ││ ¥29││ ¥79│  │
│ │5万 ││20万││60万│  │
│ └────┘└────┘└────┘  │
│ ┌──────┐             │
│ │ ¥199 │             │
│ │200万  │             │
│ └──────┘             │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 选择支付方式           │
│ · 支付宝              │
│ · 微信支付            │
│ · Stripe (海外)       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 支付确认              │
│ 支付成功 → 即时到账    │
│ 支付失败 → 重试       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Token余额更新         │
│ · purchasedTokens    │
│   += 购买量           │
│ · 写入Redis实时生效   │
│ · 持久化到PostgreSQL  │
│ · 生成购买记录/发票   │
└──────────────────────┘
```

#### 3.4.4 Token余额展示

在底部状态栏和用户菜单中实时展示：

```
底部状态栏:
┌──────────────────────────────────────────────────────────────────┐
│ 📊 总字数: 120万  |  🎫 套餐Token: 85万/100万  |  💰 增量Token: 45万  │
└──────────────────────────────────────────────────────────────────┘

用户菜单:
👤 [用户名]
 ├── 🎫 Token管理
 │    ├── 套餐Token: 85万/100万 (本月剩余)
 │    ├── 增量Token: 45万 (永久有效)
 │    ├── 📈 购买Token
 │    └── 📋 消费记录
```

#### 3.4.5 Token消费优先级

```
每次AI生成请求消耗Token时:

1. 优先消耗套餐月额度 (monthlyTokenQuota)
   → 每月1日自动重置
   
2. 套餐额度用完后，自动使用增量包Token (purchasedTokens)
   → 永远有效，不自动过期
   
3. 增量包也耗尽时
   → 弹窗提示 "Token余额不足，是否购买增量包？"
   → 点击 → 跳转Token购买页面
```

#### 3.4.6 Token相关API

```
GET    /api/v1/tokens/balance              — 获取当前Token余额（套餐+增量）
GET    /api/v1/tokens/packages              — 获取可购买的增量包列表
POST   /api/v1/tokens/purchase              — 购买Token增量包
POST   /api/v1/tokens/purchase/confirm      — 确认支付（支付宝/微信/Stripe回调）
GET    /api/v1/tokens/transactions           — 获取Token消费/购买记录
GET    /api/v1/tokens/transactions/export   — 导出消费记录
```

---

### 3.5 数据下载与离线模式（Lite及以上套餐专属）

```
┌────────────────────────────────────────────────────────────────┐
│                    数据同步架构（Lite+套餐）                      │
│                                                                │
│   云端 (PostgreSQL)              │       本地 (SQLite)          │
│   ┌────────────────┐            │    ┌────────────────┐        │
│   │ 完整数据集      │            │    │ 用户选择下载    │        │
│   │ · 所有书籍     │            │    │ 的数据子集     │        │
│   │ · 所有章节     │ ◀══ 同步 ══▶ │ · 当前创作书籍  │        │
│   │ · 设定/角色    │            │    │ · 最近章节     │        │
│   │ · 记忆/向量    │            │    │ · 核心设定     │        │
│   └────────────────┘            │    └────────────────┘        │
│                                                                │
│   同步策略:                                                     │
│   1. 用户点击"下载到本地" → 选择需要离线访问的书籍                │
│   2. 服务端生成增量快照 → 打包传输到客户端                        │
│   3. 客户端导入本地SQLite                                       │
│   4. 离线创作期间，所有修改记录操作日志（Operation Log）           │
│   5. 联网后自动同步：                                            │
│      · 客户端提交本地操作日志                                    │
│      · 服务端检测冲突（如云端也有修改）                            │
│      · 无冲突 → 自动合并                                        │
│      · 有冲突 → 弹出界面让用户手动选择                           │
│   6. 同步完成后清除操作日志，更新本地快照                          │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. 界面设计

### 4.1 整体布局

```
┌──────────────────────────────────────────────────────────────────┐
│                        顶部导航栏 (TopNavbar)                      │
│    File    Edit    View    Window    Help                        │
├──────────┬───────────────────────────────────┬───────────────────┤
│          │                                   │                   │
│  左侧     │         中央工作与对话区              │    右侧审查面板     │
│  侧边栏   │    (Central Workspace & Chat)      │   (Right Panel)  │
│          │                                   │                   │
│  ┌────┐  │  ┌─────────────────────────────┐  │  ┌─────────────┐ │
│  │新章节│  │  │                             │  │  │ 章纲编辑区    │ │
│  └────┘  │  │      富文本编辑器/对话区        │  │  │             │ │
│  ┌────┐  │  │                             │  │  └─────────────┘ │
│  │搜索 │  │  │   (Tiptap Editor / Chat)    │  │  ┌─────────────┐ │
│  └────┘  │  │                             │  │  │ 指令编辑区    │ │
│  ┌────┐  │  │                             │  │  │             │ │
│  │插件 │  │  │                             │  │  └─────────────┘ │
│  └────┘  │  │                             │  │  ┌─────────────┐ │
│  ┌────┐  │  │                             │  │  │ 生成内容调整   │ │
│  │设定 │  │  │                             │  │  │ (词句/段落/  │ │
│  └────┘  │  │                             │  │  │  全章修改)   │ │
│          │  │                             │  │  └─────────────┘ │
│  ─────── │  │                             │  │                   │
│  纲树    │  │                             │  │  富文本编辑器      │
│  ├ 大纲  │  │                             │  │                   │
│  ├ 卷纲  │  │                             │  │  纲树              │
│  ├ 章纲  │  │                             │  │  ├ 大纲           │
│          │  │                             │  │  ├ 卷纲           │
│  ─────── │  │                             │  │  └ 章纲           │
│  角色    │  │                             │  │                   │
│  ├ 主角团│  │                             │  │  作品设定          │
│  ├ 配角团│  │                             │  │                   │
│  └ 群像  │  │                             │  │  人物关系图谱      │
│          │  │                             │  │  (D3.js / Vis.js) │
│  ─────── │  │                             │  │                   │
│  世界观  │  │                             │  │                   │
│  ├ 时代  │  │                             │  │                   │
│  ├ 社会  │  │                             │  │                   │
│  ├ 力量  │  │                             │  │                   │
│  ├ 资源  │  │                             │  │                   │
│  ├ 文化  │  │                             │  │                   │
│  └ 地理  │  │                             │  │                   │
│          │  │                             │  │                   │
│  ─────── │  │                             │  │                   │
│  文风特色│  │                             │  │                   │
│          │  │                             │  │                   │
│  ─────── │  │                             │  │                   │
│  写作台  │  │                             │  │                   │
│  ├ 📚书1 │  │                             │  │                   │
│  │ ├ 章1 │  │                             │  │                   │
│  │ ├ 章2 │  │                             │  │                   │
│  │ └ ... │  │                             │  │                   │
│  ├ 📚书2 │  │                             │  │                   │
│  └ ⚙设定 │  │                             │  │                   │
│          │  │                             │  │                   │
│  ─────── │  │                             │  │                   │
│  灵感面板│  │                             │  │                   │
│  ├ 事件  │  │                             │  │                   │
│  ├ 词句  │  │                             │  │                   │
│  └ 设定  │  │                             │  │                   │
│          │  │                             │  │                   │
│  ─────── │  │                             │  │                   │
│  👤用户名│  │                             │  │                   │
│          │  │                             │  │                   │
├──────────┴───────────────────────────────────┴───────────────────┤
│                        底部状态栏 (StatusBar)                      │
│  📊 总字数: 1,200,000  |  今日: 5,200  |  ☁ 已同步  |  🤖 GPT-4  │
│  [Plus] [今日AI剩余: 44,800字] [累计额度: 250万/已用120万]         │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 顶部导航栏 (TopNavbar)

| 菜单 | 功能项 |
|------|--------|
| **File** | 新建项目、从云端打开、保存到云端、导出下载(Word/TXT)、关闭项目、退出 |
| **Edit** | 撤销、重做、剪切、复制、粘贴、删除、全选、查找/替换 |
| **View** | 缩放、全屏模式、显示/隐藏侧边栏、显示/隐藏右侧面板、切换主题 |
| **Window** | 新建窗口、关闭窗口、最小化、窗口切换、平铺排列 |
| **Help** | 帮助文档、访问官网、检查更新、关于（版本信息）、反馈问题 |

### 4.3 左侧侧边栏 (LeftSidebar)

（界面布局与v1.0一致，详见原文档3.3节。）

#### 4.3.1 用户菜单（含订阅入口）

```
👤 [用户名]  [🔄 同步中]
 ├── ⚙ 设置
 │    ├── 隐私与权限
 │    ├── 语言设置
 │    ├── 快捷键设置
 │    ├── 外观设置 (主题/字体/字号)
 │    ├── API配置
 │    └── 关于模型
 ├── 📦 我的套餐
 │    ├── 当前套餐: [Plus]
 │    ├── 升级套餐
 │    ├── 用量统计 (字数/空间)
 │    └── 账单历史
 ├── 💾 离线管理 (Lite+专属)
 │    ├── 下载书籍到本地
 │    ├── 管理本地存储
 │    └── 同步设置
 ├── 🌐 官网
 ├── 💳 API服务 (购买/充值)
 ├── 👤 账号信息
 └── 🚪 退出登录
```

### 4.4 中央工作与对话区 / 右侧审查面板 / 底部状态栏

（与v1.0一致，详见原文档3.4-3.6节。底部状态栏增加同步状态和套餐用量显示。）

---

## 5. 功能规格

（本章节v1.0的4.1-4.10功能规格保持不变，以下为v2.2变更内容。）

### 5.1 数据存储行为（按套餐）

| 操作 | Free | Lite | Basic | Plus | Pro |
|------|------|------|-------|------|-----|
| 创建新作品 | ≤1个 | ≤3个 | ≤5个 | ≤7个 | ≤15个 |
| 编辑作品内容 | 云端实时 | 云端实时 | 云端实时 | 云端实时 | 云端实时 |
| AI生成内容 | 云端保存 | 云端保存 | 云端保存 | 云端保存 | 云端保存 |
| 字数额度 | 20万字 | 50万字 | 100万字 | 200万字 | 500万字 |
| Token月额度 | 20万 | 50万 | 100万 | 200万 | 500万 |
| Token增量包 | ✅ 可购买 | ✅ 可购买 | ✅ 可购买 | ✅ 可购买 | ✅ 可购买 |
| 模型类型 | Flash | Flash | Pro | Pro | Pro |
| 并行生成槽位 | 1 | 3 | 5 | 7 | 9 |
| 数据下载到本地 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 离线创作 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 导出Word/TXT | ✅ | ✅ | ✅ | ✅ | ✅ |

### 5.2 云端同步状态指示

```
底部状态栏同步指示器:

☁ 已同步    — 本地数据与云端完全一致
🔄 同步中... — 正在上传/下载数据
⚠ 待同步    — 有本地修改未上传（离线模式下）
❌ 同步失败   — 上次同步失败，点击查看详情
🔒 仅云端    — Free套餐标识（不可下载数据）
💻 本地模式   — Lite+套餐离线模式标识
```

### 5.3 AI去味审查功能（Basic及以上套餐）

#### 5.3.1 功能概述

AI生成的文本常带有可辨识的"机器味"——通过特定的句式模式、过渡词习惯和情感表达方式可以判断出是AI所写。对于网文创作来说，这种"AI味"会严重影响读者的阅读沉浸感。

**去AI味审查**的目标：让AI生成的文本读起来像人类作家写的。

#### 5.3.2 AI味特征检测维度

| 检测维度 | 问题说明 | 检测方法 |
|---------|---------|---------|
| **句式重复度** | "不仅...而且..."、"与此同时"、"总而言之"等高频套话 | N-gram频率统计 |
| **过渡词密度** | 每段开头使用"首先/其次/最后/在此之后" | 段落首词模式匹配 |
| **情感平铺度** | 所有情感描写使用相同句式，缺乏起伏 | 情感词分布方差分析 |
| **对话差异性** | 不同角色的对话无法区分，千人一面 | 角色对话风格向量对比 |
| **过度解释** | AI习惯在每句话后补充解释 | 因果连词密度检测 |
| **节奏单一性** | 句子长度和段落结构高度一致 | 句长标准差 + 段落行数分布 |
| **修辞自然度** | 比喻/拟人生硬不自然 | 修辞手法的上下文适配度评分 |

#### 5.3.3 处理流程

```
AI生成的章节正文
        │
        ▼
┌──────────────────────────┐
│ 第一步：AI味特征扫描       │
│ · 分词 + N-gram分析      │
│ · 句式模式匹配           │
│ · 角色对话风格聚类       │
│ · 情感曲线检测           │
│ · 输出"AI味指数" (0-100) │
└───────────┬──────────────┘
            │
            ▼
    ┌───────────────┐
    │ AI味指数 > 阈值? │
    └───┬───────┬───┘
        │       │
      >50      ≤50 → 跳过，文本自然度合格
        │
        ▼
┌──────────────────────────┐
│ 第二步：人性化润色         │
│ · 随机打乱句式结构       │
│ · 注入口语化表达         │
│ · 分层情感描写           │
│ · 角色对话个性化         │
│ · 长短句交替             │
│ · 删除过度解释           │
│ · 注入适度的不完美感     │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ 第三步：差异对比展示       │
│ · 原文 vs 润色后 并列展示 │
│ · 每处修改标注原因        │
│ · AI味指数前后对比        │
│ · 用户可逐条接受/拒绝     │
│ · 支持一键全部接受        │
└──────────────────────────┘
```

#### 5.3.4 人性化润色策略

| 策略 | 说明 | 示例 |
|------|------|------|
| **句式打散** | 将相似句式随机变体 | "他不仅X，而且Y" → "他X，更难得的是Y" / "X之余，他还Y" |
| **口语注入** | 加入自然的语气词和口头禅 | "他思考片刻" → "他琢磨了一会儿" |
| **情感层次** | 用动作/环境侧面表达情感 | "他很愤怒" → "他的手指关节捏得发白" |
| **对话去模板** | 为每个角色注入不同语气 | 莽汉:短句+脏话; 书生:长句+典故; 少女:语气词+表情 |
| **节奏变化** | 刻意制造长短句交替 | 长句描写氛围 → 短句制造冲击 → 中句过渡 |
| **减法原则** | 删除AI式的解释性语句 | "这说明他已经下定了决心" → 直接删除，让读者自己体会 |
| **不完美感** | 适度加入人类写作的"瑕疵" | 偶尔的口语化、不完整的句子、半句转折 |

#### 5.3.5 用户可控参数

```
AI去味强度设置:

┌────────────────────────────────────────────┐
│  去味强度:  [1]──[3]──[5]──[7]──[10]       │
│            轻    中    强    极    重写     │
│                                            │
│  1-3 轻: 仅删除过度解释，修正最明显的套话    │
│  4-6 中: 句式变化 + 情感层次优化             │
│  7-9 强: 全面润色 + 角色对话个性化           │
│  10  重写: 保留原意，全面重写段落            │
└────────────────────────────────────────────┘
```

> **实现方式**: 检测阶段使用Flash模型（低成本快速扫描），润色阶段使用Pro模型（保证质量）。

---

### 5.4 纲树-章节同步系统 (v2.8)

#### 5.4.1 设计理念

纲树（大纲规划）和章节（正文内容）是两套独立系统，通过**单向依赖 + 快照机制**关联：

```
纲树 ──(生成时快照)──→ 章节
章节 ←──(可选关联)─── 纲树节点
```

- **纲树是规划工具**：大纲→卷纲→章纲，树形结构，自由修改
- **目录是交付产物**：分卷→章节，线性结构，读者所见
- **两者独立演进**：修改纲树不自动覆盖章节，修改章节不自动回填纲树
- **系统只做提醒**：追踪版本差异，提示"过时"或"偏离"，同步动作由作者手动触发

#### 5.4.2 两套系统的定位

```
📘 作品
│
├── 📑 目录                    ← 作品的「躯体」
│   ├── 分卷一                   ← volumes 表
│   │   ├── 第一章               ← chapters 表
│   │   └── 第二章
│   ├── 分卷二
│   └── 分卷外章节               ← 草稿/游离章节
│
└── 📋 相关                    ← 作品的「灵魂」
    ├── 纲树                     ← outlines 表（独立大纲规划）
    ├── 角色                     ← characters 表
    └── 世界观                   ← world_settings 表
```

| | 目录 | 相关→纲树 |
|------|:--|:--|
| 数据来源 | `volumes` / `chapters` 表 | `outlines` 表 |
| 结构 | 线性（分卷→章节） | 树形（大纲→卷纲→章纲） |
| 用途 | 最终交付内容 | 创作规划草稿 |
| 修改频率 | 生成后相对稳定 | 规划阶段频繁调整 |

#### 5.4.3 同步状态定义

**纲树侧 (`outlines.sync_status`)**：

| 状态 | 含义 |
|------|------|
| `synced` | 纲树与关联章节一致 |
| `outline_changed` | 纲树已更新，章节内容可能过时 |
| `chapter_changed` | 章节内容已偏离纲树 |
| `diverged` | 双向分歧，两者都已各自修改 |

**章节侧 (`chapters.outline_sync`)**：

| 状态 | 含义 |
|------|------|
| `synced` | 内容与纲树一致 |
| `stale` | 纲树已更新（对应 outline_changed） |
| `diverged` | 两者已分歧 |
| `detached` | 手动解绑，不再追踪 |

#### 5.4.4 状态流转规则

```
              创建/生成
   ┌──────→  synced  ←──────────────┐
   │          │   │                  │
   │          │   │                  │
   │   修改纲树   │  修改章节内容      │
   │          │   │                  │
   │          ↓   ↓                  │
   │   outline_changed  (纲树侧)     │
   │   stale            (章节侧)     │
   │          │   │                  │
   │          │   │                  │
   │  双方都改    │  作者手动同步     │
   │          │   │  (接受纲树重写)   │
   │          ↓   └──────────────┘   │
   │   diverged                      │
   │          │                      │
   │          ↓                      │
   │   作者手动解绑                    │
   └── detached ←───────────────────┘
```

**触发规则**：

| 操作 | 触发条件 | 纲树侧 | 章节侧 |
|------|---------|:--|:--|
| 基于纲树生成章节 | AI 生成成功 | `synced` (版本+1) | `synced` (记录快照) |
| 修改纲树 content | PATCH `/outlines/:id` | `outline_changed` | `stale` |
| 手动编辑章节正文 | 检测到 content 变化 | 检测后变 `chapter_changed` | 检测后变 `diverged` |
| 两者都改过 | 按上述规则叠加 | `diverged` | `diverged` |
| 作者手动解绑 | POST `/chapters/:id/detach-outline` | `synced` | `detached` |
| 基于新纲树重写 | POST `/outlines/:id/apply` | `synced` (版本+1) | `synced` (更新快照) |

#### 5.4.5 核心交互场景

**场景一：修改纲树 → 已生成章节**

```
修改前：
  章纲节点 A "主角修炼成功" ──生成──→ 第3章（内容按 A 生成，outlineSync = synced）

修改后：
  章纲节点 A' "主角修炼失败，转为魔道"  ← sync_status → outline_changed
  第3章                                   ← outlineSync → stale

UI 表现：
  纲树节点旁显示 🟡 + "纲已更新"
  第3章旁显示 🟡 + "纲树已过时（v1→v2），点击查看差异"
  作者可选择：[忽略] [查看差异] [接受纲树重写]
```

**场景二：修改章节 → 纲树**

```
修改前：
  章纲节点 A "主角修炼成功" ──关联──→ 第3章（outlineSync = synced）

修改后：
  第3章（作者手动改成"主角修炼失败"）  ← outlineSync → diverged
  章纲节点 A 不变                        ← sync_status → chapter_changed

UI 表现：
  章节旁显示 🟠 + "已偏离纲树"
  纲树节点旁显示 🟠 + "章节已偏离"
  作者可选择：[查看差异] [忽略] [用正文覆盖纲树]
```

**场景三：纲树删除 → 关联章节**

```
  纲树节点被删除 → 章节的 outline_node_id 自动 SET NULL（外键 ON DELETE SET NULL）
  章节的 outlineSync → detached
  章节内容不受影响，只是不再追踪纲树关系
```

#### 5.4.6 前后端接口设计

**纲树节点 ↔ 章节关联数据**：

```typescript
// outlines.linked_chapters — JSONB 结构
interface LinkedChapter {
  chapterId: string;
  chapterTitle: string;
  generatedAt: string;       // 生成时间
  outlineVersion: number;    // 生成时纲树 contentVersion
  outlineSnapshot: string;   // 生成时纲树内容快照（纯文本摘要，用于差异对比）
}
```

**差异对比 API 响应**：

```typescript
// GET /chapters/:id/outline-diff 响应
interface OutlineDiffResponse {
  chapterId: string;
  outlineNodeId: string;
  syncStatus: string;
  currentOutline: {
    content: string;
    version: number;
    updatedAt: string;
  };
  snapshotOutline: {
    content: string;
    version: number;
    generatedAt: string;
  };
  highlights: DiffSegment[];  // 差异高亮区域
}
```

---

## 6. 数据模型

### 6.1 云端数据库设计（PostgreSQL）

> **数据访问策略**: 简单CRUD使用 TypeORM Repository（类型安全）；复杂JOIN查询使用 TypeORM QueryBuilder（链式API）；全文搜索与向量混合检索使用原生SQL（`entityManager.query()`）以利用 pgvector/tsvector 扩展；批量写入（记忆提取结果）使用原生SQL `INSERT ... ON CONFLICT` 获得最佳性能。所有原生SQL必须参数化防止注入。

#### 6.1.1 用户与订阅

```sql
-- 用户
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  oauth_provider VARCHAR(50),
  oauth_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- 刷新令牌
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  device_info TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 订阅记录
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL DEFAULT 'free', -- free/lite/basic/plus/pro
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT TRUE,
  payment_provider VARCHAR(50),
  provider_subscription_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 支付记录（含订阅支付和Token购买）
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  payment_type VARCHAR(30) NOT NULL,         -- subscription/token_purchase
  subscription_id UUID REFERENCES subscriptions(id),
  token_package_id UUID REFERENCES token_packages(id),
  amount INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  provider VARCHAR(50) NOT NULL,
  provider_payment_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 每日用量记录（改为月度汇总）
CREATE TABLE monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  year_month VARCHAR(7) NOT NULL,            -- YYYY-MM
  quota_tokens_used BIGINT DEFAULT 0,        -- 套餐内Token消耗
  purchased_tokens_used BIGINT DEFAULT 0,    -- 增量包Token消耗
  total_words_generated BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year_month)
);
```

#### 6.1.2 Token购买系统表

```sql
-- Token增量包定义
CREATE TABLE token_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,                -- 小额包/标准包/大额包/超大包
  token_amount BIGINT NOT NULL,              -- Token数量
  price INTEGER NOT NULL,                    -- 价格（分）
  discount_label VARCHAR(50),               -- 折扣标签（如"最受欢迎"）
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户Token余额
CREATE TABLE token_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchased_tokens_remaining BIGINT DEFAULT 0, -- 增量包剩余Token（永不过期）
  lifetime_purchased_tokens BIGINT DEFAULT 0,  -- 累计购买Token数
  lifetime_consumed_tokens BIGINT DEFAULT 0,   -- 累计消耗Token数
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Token购买记录
CREATE TABLE token_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  package_id UUID NOT NULL REFERENCES token_packages(id),
  token_amount BIGINT NOT NULL,
  amount_paid INTEGER NOT NULL,
  payment_id UUID REFERENCES payments(id),
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Token消费明细
CREATE TABLE token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  book_id UUID REFERENCES books(id),
  chapter_id UUID REFERENCES chapters(id),
  transaction_type VARCHAR(30) NOT NULL,     -- generation/review/style_analysis/memory_extraction
  tokens_consumed INTEGER NOT NULL,
  source VARCHAR(20) NOT NULL,               -- quota/purchased（从套餐扣还是增量包扣）
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_token_tx_user_date ON token_transactions(user_id, created_at);

-- AI API 成本追踪 (按小时聚合，服务端成本监控)
CREATE TABLE ai_cost_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hour_bucket TIMESTAMPTZ NOT NULL,          -- 所属小时 (如 2026-06-09T14:00:00Z)
  provider VARCHAR(30) NOT NULL,             -- openai/anthropic/deepseek
  model VARCHAR(50) NOT NULL,
  request_count INTEGER DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  prompt_tokens BIGINT DEFAULT 0,
  completion_tokens BIGINT DEFAULT 0,
  total_cost_cents INTEGER DEFAULT 0,       -- 成本(美分)
  UNIQUE(hour_bucket, provider, model)
);
CREATE INDEX idx_cost_hour ON ai_cost_logs(hour_bucket DESC);
```

#### 6.1.2 核心创作表

```sql
-- 书籍
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  author TEXT,
  description TEXT,
  cover_url TEXT,                            -- 云端OSS地址
  word_count BIGINT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  sync_version BIGINT DEFAULT 1,             -- 乐观锁版本号，用于冲突检测
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_books_user ON books(user_id);

-- 卷
CREATE TABLE volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  volume_number INTEGER NOT NULL,
  summary TEXT,
  outline_plan TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  sync_version BIGINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_volumes_book ON volumes(book_id);

-- 章节
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volume_id UUID NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  content TEXT,
  chapter_outline TEXT,
  instruction TEXT,
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  sync_version BIGINT DEFAULT 1,

  -- 纲树关联字段 (v2.8)
  outline_node_id UUID REFERENCES outlines(id) ON DELETE SET NULL,  -- 来源纲树节点
  outline_version INTEGER DEFAULT 0,          -- 生成时纲树 contentVersion
  outline_snapshot TEXT,                       -- 生成时纲树内容快照（JSON摘要）
  outline_sync VARCHAR(20) DEFAULT 'detached', -- synced/stale/diverged/detached

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chapters_volume ON chapters(volume_id);
CREATE INDEX idx_chapters_outline_node ON chapters(outline_node_id);

-- 云端版本管理（完整历史快照，纯服务端存储）
-- 每次 AI 生成完成、用户保存、去味审查后自动创建版本快照
-- 支持任意版本回退、版本间差异对比
CREATE TABLE chapter_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,  -- 冗余加速跨章查询
  user_id UUID NOT NULL REFERENCES users(id),                    -- 版本创建者

  version_number INTEGER NOT NULL,       -- 递增版本号 (1, 2, 3...)
  content TEXT NOT NULL,                 -- 该版本的完整章节文本
  content_preview TEXT,                  -- 前200字预览（版本列表展示用）
  word_count INTEGER NOT NULL DEFAULT 0,
  word_diff INTEGER DEFAULT 0,          -- 与上一版本的字数差异

  label TEXT,                            -- "定稿" / "AI初稿" / "编辑中" / NULL
  source VARCHAR(30) NOT NULL DEFAULT 'manual',  -- ai_generate/manual_save/auto_save/review_dehumanize/revert/import

  -- 预计算差异（diff-match-patch语义差异，加速对比视图）
  diff_with_previous TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_versions_chapter ON chapter_versions(chapter_id, version_number DESC);
CREATE INDEX idx_versions_book ON chapter_versions(book_id, created_at DESC);
CREATE INDEX idx_versions_source ON chapter_versions(book_id, source);
```

#### 6.1.3 设定与角色表

```sql
-- 作品设定
CREATE TABLE world_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  content_version INTEGER DEFAULT 1,       -- 设定内容的修订版本号（用户手动编辑递增）
  sync_version BIGINT DEFAULT 1,           -- 云端同步乐观锁版本号（系统自动管理）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 大纲 / 纲树 (v2.8 扩展同步字段)
CREATE TABLE outlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL,
  volume_id UUID REFERENCES volumes(id),
  chapter_id UUID REFERENCES chapters(id),
  title TEXT NOT NULL,
  content TEXT,
  parent_id UUID REFERENCES outlines(id),
  sort_order INTEGER DEFAULT 0,
  sync_version BIGINT DEFAULT 1,

  -- 纲树-章节同步字段 (v2.8)
  linked_chapters JSONB DEFAULT '[]',            -- 关联章节列表: [{chapterId, chapterTitle, generatedAt, outlineVersion, outlineSnapshot}]
  sync_status VARCHAR(20) DEFAULT 'synced',      -- synced/outline_changed/chapter_changed/diverged
  content_version INTEGER DEFAULT 1,             -- 内容版本号，每次修改纲树+1

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 角色
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  alias TEXT,
  category VARCHAR(20) DEFAULT 'supporting',
  background TEXT,
  personality TEXT,
  abilities TEXT,
  appearance TEXT,
  goals TEXT,
  arc_summary TEXT,
  sync_version BIGINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 角色关系
CREATE TABLE character_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  source_char_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  target_char_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  relation_type VARCHAR(50),
  description TEXT,
  intensity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 角色状态快照
CREATE TABLE character_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  physical_state TEXT,
  mental_state TEXT,
  emotional_state TEXT,
  location TEXT,
  possessions TEXT,
  chapter_timestamp INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 6.1.4 伏笔、事件、向量记忆

```sql
-- 伏笔追踪
CREATE TABLE foreshadows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'minor',
  status VARCHAR(20) DEFAULT 'active',
  planted_chapter_id UUID REFERENCES chapters(id),
  resolved_chapter_id UUID REFERENCES chapters(id),
  progress_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 事件记忆
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id),
  title TEXT NOT NULL,
  summary TEXT,
  event_type VARCHAR(30),
  importance INTEGER DEFAULT 5,
  embedding vector(1536),                   -- pgvector: OpenAI text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 支线线程
CREATE TABLE subplot_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  started_chapter_id UUID REFERENCES chapters(id),
  ended_chapter_id UUID REFERENCES chapters(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 设定补丁（世界设定的增量更新记录）
CREATE TABLE setting_patches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  world_setting_id UUID REFERENCES world_settings(id),
  patch_content TEXT NOT NULL,
  patch_type VARCHAR(30),                   -- addition/modification/deprecation
  chapter_id UUID REFERENCES chapters(id),
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 风格锚点
CREATE TABLE style_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id),
  style_features JSONB,                     -- 风格特征JSON
  sample_text TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 向量索引 (pgvector)
CREATE INDEX idx_events_embedding ON events USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_patches_embedding ON setting_patches USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_style_embedding ON style_anchors USING ivfflat (embedding vector_cosine_ops);

-- 全文搜索索引
ALTER TABLE chapters ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('chinese', coalesce(title,'') || ' ' || coalesce(content,''))) STORED;
CREATE INDEX idx_chapters_search ON chapters USING GIN (search_vector);

ALTER TABLE characters ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('chinese', coalesce(name,'') || ' ' || coalesce(background,''))) STORED;
CREATE INDEX idx_characters_search ON characters USING GIN (search_vector);

-- 通知记录
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,               -- conflict/quota/review/system/milestone
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,                              -- 关联数据（如章节ID等）
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE NOT is_read;

-- 审计日志
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,             -- chapter.create/ai.generate/token.purchase/...
  resource_type VARCHAR(50),
  resource_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_user_time ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
```

#### 6.1.5 灵感与素材、统计、文风（略）

与v1.0 5.2.4-5.2.6节一致，将 `TEXT PRIMARY KEY` 改为 `UUID PRIMARY KEY DEFAULT gen_random_uuid()`，`DATETIME` 改为 `TIMESTAMPTZ`。

#### 6.1.6 同步操作日志（Lite及以上套餐离线模式专用）

```sql
-- 离线操作日志 (仅在客户端SQLite中存在)
-- 记录离线期间的所有数据变更，联网后用于增量同步
CREATE TABLE operation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,         -- book/volume/chapter/outline/character/...
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,           -- INSERT/UPDATE/DELETE
  payload TEXT,                      -- JSON格式的完整数据快照
  client_timestamp INTEGER NOT NULL, -- 客户端时间戳
  synced INTEGER DEFAULT 0           -- 0=未同步 1=已同步
);
```

---

## 7. AI系统设计

### 7.1 服务端AI编排架构

```
客户端请求
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│                     AI 编排服务                           │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ 模型路由器    │  │ Prompt组装器  │  │ 流式响应代理    │ │
│  │ Model Router │  │ Prompt       │  │ SSE Proxy      │ │
│  │              │  │ Assembler    │  │                │ │
│  │ 根据任务类型  │  │              │  │ 建立到模型提供商│ │
│  │ 和套餐选择   │  │ 从记忆系统    │  │ 的SSE连接      │ │
│  │ 最佳模型     │  │ 拉取上下文    │  │ 中转给客户端    │ │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘ │
│         │                │                   │          │
│         └────────────────┼───────────────────┘          │
│                          │                              │
└──────────────────────────┼──────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │ OpenAI   │     │Anthropic │     │ DeepSeek │  ...
   │ API      │     │ API      │     │ API      │
   └──────────┘     └──────────┘     └──────────┘
```

### 7.2 多模型路由策略

```typescript
interface ModelRoutingRule {
  task: TaskType;
  defaultModel: string;
  fallbackModels: string[];       // 故障切换备选
  modelTier: ModelType;            // 该任务使用的模型类型：FLASH 或 PRO
  // Free/Lite 只能使用 FLASH 类型模型
  // Basic/Plus/Pro 可以使用 PRO 类型模型
  costPer1KTokens: number;
}

enum TaskType {
  CHAPTER_GENERATION = 'chapter_generation',   // 正文生成
  OUTLINE_GENERATION = 'outline_generation',   // 大纲/章纲生成
  CHARACTER_CREATION = 'character_creation',   // 角色创建
  QUALITY_INSPECTION = 'quality_inspection',   // 质检审查
  STYLE_ANALYSIS = 'style_analysis',           // 文风分析
  MEMORY_EXTRACTION = 'memory_extraction',     // 记忆提取/摘要
  NAME_GENERATION = 'name_generation',         // 名称生成
  EMBEDDING = 'embedding',                     // 向量嵌入
}
```

### 7.2.1 用户与大模型API的用量权衡架构

```
                      ┌─────────────────────────────────────────┐
                      │           API 用量管理层                   │
                      │  (API Usage Management Layer)            │
                      │                                         │
  ┌─────────┐         │  ┌──────────┐  ┌──────────┐  ┌───────┐ │
  │ 用户请求 │────────▶│  │ 额度校验  │  │ 成本预估  │  │ 排队  │ │
  │ (x 1000)│         │  │ Quota    │  │ Cost     │  │ Queue │ │
  └─────────┘         │  │ Check    │  │ Estimate │  │       │ │
                      │  └────┬─────┘  └────┬─────┘  └───┬───┘ │
                      │       │             │            │      │
                      │       ▼             ▼            ▼      │
                      │  ┌──────────────────────────────────┐   │
                      │  │         模型路由器                │   │
                      │  │    (按套餐+任务+成本+可用性路由)   │   │
                      │  └──────────┬───────────────────────┘   │
                      │             │                           │
                      │   ┌─────────┼─────────┐                │
                      │   ▼         ▼         ▼                │
                      │ ┌────┐  ┌────┐  ┌────────┐            │
                      │ │OpenAI│ │Anth│ │DeepSeek│ ...        │
                      │ └────┘  └────┘  └────────┘            │
                      │                                         │
                      │  核心职责: 公平分配 · 成本控制 · 质量保障 │
                      └─────────────────────────────────────────┘
```

#### 7.2.2 API Key 集中管理

**设计原则**: 用户不直接持有API Key，服务端统一代理所有AI请求。

```
┌──────────────────────────────────────────────────────────────┐
│                   API Key 管理架构                             │
│                                                              │
│  服务端环境变量 (加密存储):                                     │
│  ├── OPENAI_API_KEY         → OpenAI 官方 API                │
│  ├── ANTHROPIC_API_KEY      → Anthropic 官方 API             │
│  ├── DEEPSEEK_API_KEY       → DeepSeek 官方 API              │
│  ├── OPENAI_BACKUP_KEY_1    → 备用Key (故障切换)              │
│  └── ...                    → 更多Provider备用Key             │
│                                                              │
│  每个Provider支持多Key轮询:                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ KeyPool {                                           │    │
│  │   provider: 'openai',                               │    │
│  │   keys: [                                           │    │
│  │     { key: 'sk-xxx1', rpm: 500,   used: 320 },     │    │
│  │     { key: 'sk-xxx2', rpm: 500,   used: 450 },     │    │
│  │     { key: 'sk-xxx3', rpm: 3500,  used: 1800 },     │    │
│  │   ],                                                │    │
│  │   strategy: 'least-loaded'  // 负载最低优先          │    │
│  │ }                                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  优势:                                                        │
│  · 用户零配置 — 无需自行申请API Key                            │
│  · 成本可控 — 服务端统一采购、统一议价                          │
│  · 安全隔离 — API Key 不暴露给客户端                           │
│  · 故障切换 — 单个Key限流时自动切换备用Key                      │
│  · 多Provider — 按成本和质量动态选择最优Provider                │
└──────────────────────────────────────────────────────────────┘
```

#### 7.2.3 请求前：额度校验与成本预估

```typescript
// server/src/modules/ai/preflight.service.ts

@Injectable()
export class PreflightService {
  /**
   * 请求预处理 — 在发往AI Provider之前执行
   * 校验通过 → 放行；不通过 → 返回明确错误码和推荐操作
   */
  async preflightCheck(userId: string, task: TaskType, params: GenerateParams): Promise<PreflightResult> {
    const user = await this.userService.getUserWithTier(userId);
    const plan = SUBSCRIPTION_PLANS[user.tier];

    // ===== 1. 套餐功能权限校验 =====
    if (!this.isTaskAllowed(task, user.tier)) {
      return {
        allowed: false,
        errorCode: 'PERM_FEATURE_LOCKED',
        message: `此功能需要 ${this.getRequiredTier(task)} 及以上套餐`,
        actions: [{ label: '升级套餐', type: 'upgrade', route: '/pricing' }],
      };
    }

    // ===== 2. 额度校验 =====
    const usage = await this.usageService.getCurrentUsage(userId);
    const wordLimit = plan.totalWordLimit;
    if (usage.totalWordsGenerated >= wordLimit) {
      return {
        allowed: false,
        errorCode: 'PERM_WORD_LIMIT_REACHED',
        message: `字数额度已用完 (${wordLimit.toLocaleString()}字)，请升级套餐`,
        actions: [{ label: '升级套餐', type: 'upgrade', route: '/pricing' }],
      };
    }

    // ===== 3. Token余额校验 =====
    const estimatedTokens = this.estimateTokens(task, params);
    const balance = await this.tokenService.getBalance(userId);
    if (balance.totalRemaining < estimatedTokens * 0.5) {
      // 预估消耗 > 剩余50% → 警告但允许（流式生成中可能提前结束）
      return {
        allowed: true,
        warning: {
          code: 'TOKEN_LOW_WARNING',
          message: `Token余额不足，预计本次消耗 ${estimatedTokens.toLocaleString()} Token，剩余 ${balance.totalRemaining.toLocaleString()} Token`,
        },
        estimatedTokens,
        estimatedCost: this.estimateCost(task, estimatedTokens, user.tier),
      };
    }

    // ===== 4. 并行槽位校验 =====
    const activeSlots = await this.getActiveGenerationSlots(userId);
    if (activeSlots >= plan.parallelSlots) {
      return {
        allowed: false,
        errorCode: 'PERM_SLOTS_FULL',
        message: `并行生成槽位已满 (${plan.parallelSlots}个)，请等待当前任务完成`,
        retryAfterMs: this.estimateNextSlotAvailable(userId),
      };
    }

    return { allowed: true, estimatedTokens, estimatedCost: this.estimateCost(task, estimatedTokens, user.tier) };
  }

  /**
   * Token消耗预估 (基于历史数据 + 任务类型)
   * 公式: 基础Token + (目标字数 × 1.5) + 记忆上下文Token
   */
  private estimateTokens(task: TaskType, params: GenerateParams): number {
    const baseTokens = TASK_BASE_TOKENS[task];
    const outputTokens = (params.targetWordCount || 3000) * 1.5;
    const contextTokens = params.contextSize || 3000;
    return Math.ceil(baseTokens + outputTokens + contextTokens);
  }

  /**
   * 成本预估 (人民币，分)
   */
  private estimateCost(task: TaskType, tokens: number, tier: SubscriptionTier): number {
    const modelTier = TASK_MODEL_TIER[task];
    const ratePer1K = modelTier === 'pro' ? 0.04 : 0.01;  // Flash ≈ ¥0.01/1K, Pro ≈ ¥0.04/1K
    return Math.ceil(tokens / 1000 * ratePer1K * 100);  // 返回分
  }
}
```

#### 7.2.4 请求中：并发控制与排队

```
用户请求队列管理:

  ┌──────────────────────────────────────────────────┐
  │               并发槽位管理器                        │
  │                                                  │
  │  Free (1槽位):                                    │
  │  ┌────┐                                          │
  │  │ 任务│ → 执行中                                  │
  │  └────┘                                          │
  │  ┌────┐ ┌────┐ ┌────┐                            │
  │  │排队1│→│排队2│→│排队3│  → 等待队列(FIFO, 最多10)   │
  │  └────┘ └────┘ └────┘                            │
  │                                                  │
  │  Pro (9槽位):                                     │
  │  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌───┐┌───┐┌───┐│
  │  │槽1 ││槽2 ││槽3 ││槽4 ││槽5 ││槽6 ││槽7││槽8││槽9││
  │  └────┘└────┘└────┘└────┘└────┘└────┘└───┘└───┘└───┘│
  │  全部并发执行，无等待                                │
  └──────────────────────────────────────────────────┘

  排队策略:
  · 同用户: FIFO (先进先出)
  · 全局: 按套餐等级优先 (Pro > Plus > Basic > Lite > Free)
  · 单用户最大排队数: 10 (超出提示"排队已满，请等待")
  · 排队超时: 300秒后自动取消
  · 实时推送排队位置: WebSocket "queue:position" 事件
```

#### 7.2.5 请求后：消费扣减与成本追踪

```typescript
// 消费扣减优先级 (每次AI请求完成后执行)
// 1. 优先消耗套餐月额度 (monthlyTokenQuota)
// 2. 套餐额度耗尽 → 消耗增量包Token (purchasedTokens)
// 3. 增量包也耗尽 → 拒绝请求

// server/src/modules/ai/postflight.service.ts

@Injectable()
export class PostflightService {
  async recordConsumption(params: {
    userId: string;
    bookId: string;
    chapterId: string;
    taskType: TaskType;
    tokensConsumed: number;       // 实际消耗Token (从AI Provider响应中获取)
    modelUsed: string;
    durationMs: number;
  }): Promise<ConsumptionResult> {
    const { userId, tokensConsumed, taskType } = params;

    // 1. 从Redis获取当月用量 (原子操作)
    const quotaKey = `usage:${userId}:${this.currentYearMonth()}`;
    const usage = await this.redis.hgetall(quotaKey);
    const quotaUsed = parseInt(usage.quotaTokensUsed || '0');
    const plan = await this.getUserPlan(userId);

    let remainingQuota = plan.monthlyTokenQuota - quotaUsed;
    let fromQuota = 0;
    let fromPurchased = 0;

    if (remainingQuota >= tokensConsumed) {
      // 套餐额度足够 → 全部从套餐扣
      fromQuota = tokensConsumed;
      await this.redis.hincrby(quotaKey, 'quotaTokensUsed', tokensConsumed);
    } else {
      // 套餐额度不够 → 先用套餐，再用增量包
      fromQuota = Math.max(0, remainingQuota);
      fromPurchased = tokensConsumed - fromQuota;

      if (fromQuota > 0) {
        await this.redis.hincrby(quotaKey, 'quotaTokensUsed', fromQuota);
      }

      // 扣减增量包Token
      const purchasedRemaining = await this.redis.hincrby(
        `token:balance:${userId}`, 'purchasedTokensRemaining', -fromPurchased
      );

      if (purchasedRemaining < 0) {
        // 极少情况：并发导致余额不够 → 回滚，返回错误
        await this.redis.hincrby(`token:balance:${userId}`, 'purchasedTokensRemaining', fromPurchased);
        throw new InsufficientTokenException();
      }
    }

    // 2. 持久化消费记录到 PostgreSQL
    await this.tokenTransactionRepo.save({
      userId, bookId: params.bookId, chapterId: params.chapterId,
      transactionType: taskType,
      tokensConsumed,
      source: fromPurchased > 0 ? 'purchased' : 'quota',
      quotaTokensUsed: fromQuota,
      purchasedTokensUsed: fromPurchased,
      modelUsed: params.modelUsed,
      durationMs: params.durationMs,
      createdAt: new Date(),
    });

    // 3. 更新月度和累计字数
    await this.updateWordCountStats(userId, params);

    // 4. 发布事件 (用于通知、监控、告警)
    this.eventBus.publish({
      type: 'token.consumed',
      payload: { userId, tokensConsumed, fromQuota, fromPurchased, taskType },
    });

    // 5. 检查是否需要额度预警
    const newRemaining = plan.monthlyTokenQuota - quotaUsed - fromQuota;
    const pctRemaining = newRemaining / plan.monthlyTokenQuota;
    if (pctRemaining <= 0.2 && pctRemaining > 0) {
      this.eventBus.publish({ type: 'token.quota.warning', payload: { userId, remainingPct: pctRemaining } });
    } else if (pctRemaining <= 0) {
      this.eventBus.publish({ type: 'token.quota.exhausted', payload: { userId, plan: plan.tier } });
    }

    return { tokensConsumed, fromQuota, fromPurchased, remainingQuota: Math.max(0, newRemaining) };
  }
}
```

#### 7.2.6 多Provider故障切换与降级

```typescript
// server/src/modules/ai/model-router.service.ts

@Injectable()
export class ModelRouterService {
  /**
   * 智能路由: 主Provider → 故障切换 → 降级
   *
   * 路由决策因素 (优先级从高到低):
   * 1. 套餐模型类型 (Flash/Pro) — 硬约束
   * 2. 任务类型推荐模型 — 软偏好
   * 3. Provider可用性 (健康检查) — 硬约束
   * 4. Provider当前负载 (RPM利用率最低) — 负载均衡
   * 5. Provider成本 (同质量下选便宜的) — 成本优化
   */
  async route(userId: string, task: TaskType): Promise<ResolvedRoute> {
    const user = await this.userService.getUserWithTier(userId);
    const rules = this.getRoutingRules(task, user.tier);

    // 尝试顺序: 主Provider → 备用Provider 1 → 备用Provider 2 → 降级模型
    for (const rule of rules) {
      const provider = this.providerPool.getLeastLoaded(rule.provider, rule.model);
      if (provider && provider.isHealthy) {
        return {
          provider: rule.provider,
          model: rule.model,
          apiKey: provider.nextKey(),  // KeyPool轮询
        };
      }
    }

    // 所有Provider不可用 → 降级到最低成本的可用模型
    const fallback = await this.emergencyFallback(task);
    if (!fallback) {
      throw new AllProvidersUnavailableException();
    }
    return fallback;
  }

  /**
   * 健康检查: 定期探测各Provider (每30秒)
   */
  @Cron('*/30 * * * * *')
  async healthCheck() {
    for (const provider of this.providers) {
      try {
        const start = Date.now();
        await provider.ping();  // 发送最小请求验证连通性
        provider.latencyMs = Date.now() - start;
        provider.isHealthy = true;
        provider.consecutiveFailures = 0;
      } catch (e) {
        provider.consecutiveFailures++;
        if (provider.consecutiveFailures >= 3) {
          provider.isHealthy = false;
          this.logger.error(`Provider ${provider.name} marked UNHEALTHY after 3 consecutive failures`);
          this.eventBus.publish({ type: 'ai.provider.unhealthy', payload: { provider: provider.name } });
        }
      }
    }
  }
}

// 故障切换链 (按任务类型)
const FALLBACK_CHAINS: Record<TaskType, ProviderChain[]> = {
  [TaskType.CHAPTER_GENERATION]: [
    { provider: 'deepseek',   model: 'deepseek-v4-pro',   tier: 'pro' },
    { provider: 'anthropic',  model: 'claude-sonnet-4-6', tier: 'pro' },
    { provider: 'openai',     model: 'gpt-4o',             tier: 'pro' },
    { provider: 'deepseek',   model: 'deepseek-v4-flash',  tier: 'flash' },  // 降级
  ],
  [TaskType.MEMORY_EXTRACTION]: [
    { provider: 'deepseek',   model: 'deepseek-v4-flash',  tier: 'flash' },
    { provider: 'openai',     model: 'gpt-4o-mini',        tier: 'flash' },
  ],
  [TaskType.EMBEDDING]: [
    { provider: 'openai',     model: 'text-embedding-3-small', tier: 'flash' },
  ],
  // ... 其他任务类型的故障切换链
};
```

#### 7.2.7 成本控制策略汇总

| 层面 | 策略 | 说明 |
|------|------|------|
| **用户侧** | 套餐Token月额度 | Free=20万, Lite=50万, Basic=100万, Plus=200万, Pro=500万 |
| **用户侧** | 字数额度 | 累计字数额度，达到后禁止生成(需升级) |
| **用户侧** | 并行槽位限制 | Free=1个, Lite=3个, ..., Pro=9个 |
| **用户侧** | 模型降级 | Free/Lite只能使用Flash模型(成本约为Pro的1/4) |
| **服务端** | 多Key轮询 | 单Provider多Key负载均衡，避免单Key被限流 |
| **服务端** | 故障切换 | 主Provider不可用→自动切换备用(用户无感知) |
| **服务端** | 模型降级 | 所有Pro模型不可用→降级到Flash(通知用户) |
| **服务端** | 请求合并 | 相同Prompt+相同参数的请求30秒内返回缓存结果 |
| **服务端** | 上下文压缩 | 超长上下文自动压缩摘要，减少Prompt Token消耗 |
| **服务端** | 异步任务 | 记忆提取/质检审查用Flash模型异步后台执行 |
| **全局** | 全局速率上限 | 服务端总并发连接到各Provider不超过KeyPool上限 |
| **全局** | 成本告警 | 单日/单月总成本超预算时告警(钉钉/飞书/Slack) |

#### 7.2.8 成本监控仪表 (服务端)

```typescript
// 每小时的AI成本统计 (用于实时监控和告警)
interface HourlyCostMetric {
  hour: string;                    // '2026-06-09T14:00:00Z'
  provider: string;
  model: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;               // 人民币(分)
  avgCostPerRequest: number;
  byTier: Record<SubscriptionTier, {
    requests: number;
    tokens: number;
    cost: number;
  }>;
  byTaskType: Record<TaskType, {
    requests: number;
    tokens: number;
    cost: number;
  }>;
}

// 告警规则:
// · 单小时成本 > ¥500 → 告警
// · 单日成本 > ¥5,000 → 告警  
// · 单用户单日Token消耗 > 100万 → 人工审核
// · Provider错误率 > 10% → 自动切换备用
```

### 7.3 Prompt模板 / 流式生成 / 上下文管理

（与v1.0 6.1-6.3节一致。区别在于这些逻辑在**服务端**执行，客户端通过SSE接收结果。）

---

## 8. 记忆系统

### 8.1 云端记忆架构

（三级记忆架构的核心设计与v1.0 7.1-7.7节一致，区别在于存储位置：）

| 组件 | v1.0 (本地) | v2.0 (云端) |
|------|------------|------------|
| 长期记忆存储 | SQLite结构化表 | PostgreSQL结构化表 |
| 向量存储 | LanceDB (本地) | pgvector (PostgreSQL扩展) |
| 向量嵌入生成 | 客户端本地 | 服务端统一调用embedding API |
| 短期记忆 | 内存 | 内存 + Redis缓存 |
| 记忆提取管道 | 客户端触发 | 服务端异步队列 (BullMQ) |

### 8.2 记忆提取管道（服务端异步）

```
新章节生成并通过审核
    │
    ▼
┌───────────────────────────────┐
│ 发布消息到 BullMQ 队列         │
│ "memory:extraction:{bookId}"  │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ 记忆提取Worker (独立进程)      │
│                               │
│ ┌───────────────────────────┐ │
│ │ 1. 摘要事件抽取 (LLM)      │ │
│ │ 2. 角色状态比较更新 (LLM)  │ │
│ │ 3. 物品货币比较更新       │ │
│ │ 4. 伏笔扫描与更新 (LLM)    │ │
│ │ 5. 设定更新检测 (LLM)      │ │
│ │ 6. 主支线进度更新          │ │
│ │ 7. 角色交互记录更新        │ │
│ │ 8. 风格锚点更新            │ │
│ │ 9. 生成Embedding向量       │ │
│ │ 10. 冲突检测扫描            │ │
│ └───────────────────────────┘ │
│                               │
│ 结果写入 PostgreSQL           │
│ 向量写入 pgvector 索引        │
│ 如有冲突 → 推送给用户通知     │
└───────────────────────────────┘
```

### 8.3 混合检索服务

```sql
-- pgvector 混合检索示例
-- 语义相似度 + 关键词匹配 + 元数据过滤 + 时间衰减

SELECT
  e.id,
  e.title,
  e.summary,
  e.event_type,
  e.importance,
  -- 余弦相似度
  (1 - (e.embedding <=> $query_embedding::vector)) AS similarity,
  -- 关键词匹配得分（如有全文搜索条件）
  ts_rank(e.search_vector, plainto_tsquery('chinese', $keyword)) AS text_rank,
  -- 时间衰减因子（越新的记忆权重越高）
  EXP(-0.01 * EXTRACT(DAY FROM (NOW() - e.created_at))) AS time_decay,
  -- 综合得分
  (
    (1 - (e.embedding <=> $query_embedding::vector)) * 0.6 +
    COALESCE(ts_rank(e.search_vector, plainto_tsquery('chinese', $keyword)), 0) * 0.2 +
    EXP(-0.01 * EXTRACT(DAY FROM (NOW() - e.created_at))) * 0.2
  ) AS final_score
FROM events e
WHERE
  e.book_id = $book_id
  AND (e.embedding <=> $query_embedding::vector) < 0.8  -- 相似度阈值
ORDER BY final_score DESC
LIMIT 20;
```

---

## 9. Agent系统

（Agent定义与v1.0第8节一致，区别在于Agent在**服务端**运行。）

### 9.1 服务端Agent执行流程

```
客户端发起"生成新章节"请求
    │
    ▼
┌────────────────────────────────────────────────────────┐
│                  工作管家 (Orchestrator)                  │
│                                                        │
│  1. 验证用户权限、今日剩余额度和字数额度              │
│  2. 调用记忆管家组装工作记忆                              │
│  3. 调用文风模拟师获取风格参数                            │
│  4. 调用架构师确认章纲（如需要）                          │
│  5. 组装最终Prompt                                      │
│  6. 调用大模型生成正文（SSE流式返回给客户端）              │
│  7. 正文生成完成后：                                     │
│     a. 异步调用质检员进行质量审查                         │
│     b. 异步触发记忆提取管道                              │
│     c. 更新用户今日用量                                  │
└────────────────────────────────────────────────────────┘
```

| Agent | 执行位置 | 触发方式 |
|-------|---------|---------|
| 架构师 | 服务端 | 用户触发（生成章纲）/ 联级更新自动触发 |
| 人设师 | 服务端 | 用户触发（创建角色）/ 新章节发现新角色自动触发 |
| 世界构建师 | 服务端 | 用户触发 / 设定冲突时自动触发 |
| 文风模拟师 | 服务端 | 用户导入文风样本时 / 每次生成前自动调用 |
| 质检员 | 服务端 | 新章节生成后自动异步执行 |

---

## 10. 云端基础设施

### 10.1 部署架构

```
                            ┌──────────────┐
                            │   CDN (OSS)  │
                            │  静态资源分发 │
                            └──────┬───────┘
                                   │
        ┌──────────────────────────┴──────────────────────────┐
        │                   负载均衡 (SLB/ALB)                  │
        │              限流 · SSL终止 · 健康检查                │
        └──────────────┬────────────────────┬─────────────────┘
                       │                    │
        ┌──────────────▼──────┐    ┌────────▼─────────────────┐
        │  API Server (xN)    │    │  WebSocket Server (xN)   │
        │  NestJS 应用实例     │    │  实时同步 · 通知推送      │
        │  无状态 · 水平扩展   │    │  Socket.io · Redis适配器 │
        └──────────┬──────────┘    └────────┬─────────────────┘
                   │                        │
        ┌──────────▼────────────────────────▼─────────────────┐
        │                    Redis Cluster                      │
        │  会话存储 · 限流计数 · 消息队列 · 发布/订阅           │
        └────────────────────────┬─────────────────────────────┘
                                 │
        ┌────────────────────────▼─────────────────────────────┐
        │               PostgreSQL 16 主从集群                   │
        │  主库 (读写) · 从库 (只读) · pgvector 扩展             │
        │  自动备份 · PITR (时间点恢复)                          │
        └──────────┬───────────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐    ┌──────────────────────────┐
        │  任务队列 (BullMQ)   │    │  对象存储 (OSS/S3)        │
        │  记忆提取 · 导出    │    │  导出文件 · 用户上传      │
        │  质检审查 · 通知    │    │  备份归档 · 静态资源      │
        └─────────────────────┘    └──────────────────────────┘
```

### 10.2 容器化部署 (Docker Compose - 开发环境)

```yaml
# docker-compose.yml
# Docker Compose 不再需要顶层 version 字段 (Compose v2+)
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: novel_assistant
      POSTGRES_USER: novel
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./server/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro  # pgvector 扩展初始化
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data
    ports:
      - "6379:6379"

  api:
    build: ./server
    environment:
      DATABASE_URL: postgresql://novel:${DB_PASSWORD}@postgres:5432/novel_assistant
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      OSS_ENDPOINT: ${OSS_ENDPOINT}
      OSS_ACCESS_KEY: ${OSS_ACCESS_KEY}
      OSS_SECRET_KEY: ${OSS_SECRET_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  worker:
    build: ./server
    command: node dist/worker.js
    environment:
      DATABASE_URL: postgresql://novel:${DB_PASSWORD}@postgres:5432/novel_assistant
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  pgdata:
  redisdata:
```

### 10.3 生产环境推荐配置

| 资源 | 规格 | 说明 |
|------|------|------|
| API服务器 | 4核8G × 3台 (最小) | 根据用户量水平扩展 |
| PostgreSQL | 8核32G 主库 + 4核16G 从库 | 使用云服务商托管版（RDS） |
| Redis | 4核16G 集群模式 | 使用云服务商托管版 |
| 对象存储 | 按量付费 | OSS/S3标准存储 |
| CDN | 按流量付费 | 加速静态资源和导出文件下载 |
| BullMQ Worker | 2核4G × 2台 | 处理异步任务 |

### 10.4 API版本与端点规范

> **API版本前缀**: 所有业务API均以 `/api/v1` 为前缀，通过 NestJS `app.setGlobalPrefix('api/v1')` 全局配置。健康检查路径 `/health` 不受版本前缀影响。

#### 10.4.1 WebSocket 事件定义

```typescript
// shared/types/ws.types.ts

// 客户端 → 服务端
enum WsClientEvent {
  SUBSCRIBE_BOOK = 'book:subscribe',       // 订阅书籍实时更新
  UNSUBSCRIBE_BOOK = 'book:unsubscribe',   // 取消订阅
  REQUEST_SYNC = 'sync:request',           // 请求增量同步
  RESOLVE_CONFLICT = 'conflict:resolve',   // 提交冲突解决方案
  PING = 'ping',                           // 心跳
}

// 服务端 → 客户端
enum WsServerEvent {
  CHAPTER_UPDATED = 'chapter:updated',     // 章节内容更新（多端同步）
  CHAPTER_CREATED = 'chapter:created',
  CHAPTER_DELETED = 'chapter:deleted',
  OUTLINE_UPDATED = 'outline:updated',     // 大纲变更
  SYNC_COMPLETED = 'sync:completed',       // 同步完成
  CONFLICT_DETECTED = 'conflict:detected', // 冲突通知
  QUOTA_WARNING = 'quota:warning',         // 额度预警（达80%时）
  QUOTA_EXHAUSTED = 'quota:exhausted',     // 额度耗尽
  REVIEW_COMPLETED = 'review:completed',   // 质检/AI去味审查完成
  NOTIFICATION_NEW = 'notification:new',   // 新通知
  PONG = 'pong',                           // 心跳响应
}
```

#### 10.4.2 REST API 端点

```
Base URL: https://api.novel-assistant.com/v1

认证相关:
  POST   /auth/register
  POST   /auth/login
  POST   /auth/refresh
  POST   /auth/logout

用户相关:
  GET    /users/me
  PATCH  /users/me

订阅相关:
  GET    /subscription/plans              — 获取所有套餐信息
  GET    /subscription/current            — 获取当前订阅状态
  POST   /subscription/subscribe          — 订阅/升级套餐
  POST   /subscription/cancel             — 取消自动续费
  POST   /subscription/resume             — 恢复订阅
  GET    /subscription/usage              — 获取用量统计
  GET    /subscription/invoices           — 获取账单历史
  POST   /subscription/webhook            — 支付回调 (支付宝/微信/Stripe)

Token相关:
  GET    /tokens/balance                    — Token余额（套餐+增量）
  GET    /tokens/packages                   — 可购买增量包列表
  POST   /tokens/purchase                   — 购买Token增量包
  GET    /tokens/transactions               — Token消费记录

书籍相关:
  GET    /books
  POST   /books
  GET    /books/:id
  PATCH  /books/:id
  DELETE /books/:id

卷相关:
  GET    /books/:bookId/volumes
  POST   /books/:bookId/volumes
  PATCH  /volumes/:id
  DELETE /volumes/:id

章节相关:
  GET    /volumes/:volumeId/chapters
  POST   /volumes/:volumeId/chapters
  GET    /chapters/:id
  PATCH  /chapters/:id
  DELETE /chapters/:id
  GET    /chapters/:id/versions
  POST   /chapters/:id/versions/:versionId/restore

大纲相关:
  GET    /books/:bookId/outlines
  POST   /books/:bookId/outlines
  PATCH  /outlines/:id
  DELETE /outlines/:id
  GET    /books/:bookId/outlines/sync-status    — 纲树整体同步状态 (v2.8)
  POST   /books/:bookId/outlines/:id/apply      — 将纲树应用到章节 (v2.8)

纲树-章节同步相关 (v2.8):
  GET    /chapters/:id/outline-diff             — 查看章节与纲树差异
  POST   /chapters/:id/detach-outline           — 断开纲树关联
  POST   /chapters/:id/sync-from-outline        — 从纲树同步重写

角色相关:
  GET    /books/:bookId/characters
  POST   /books/:bookId/characters
  PATCH  /characters/:id
  DELETE /characters/:id
  GET    /books/:bookId/character-graph   — 人物关系图谱数据

世界观相关:
  GET    /books/:bookId/world-settings
  POST   /books/:bookId/world-settings
  PATCH  /world-settings/:id

AI生成:
  POST   /ai/generate-chapter-outline     — 生成章纲 (SSE)
  POST   /ai/generate-content             — 生成正文 (SSE)
  POST   /ai/generate-outline             — 生成大纲 (SSE)
  POST   /ai/generate-characters           — 生成角色 (SSE)
  POST   /ai/rewrite                      — 局部重写 (SSE)
  POST   /ai/review                       — 基础审查
  POST   /ai/review/dehumanize            — AI去味审查 (Basic+)

记忆系统:
  GET    /books/:bookId/memory/events
  GET    /books/:bookId/memory/foreshadows
  GET    /books/:bookId/memory/character-states
  POST   /books/:bookId/memory/search     — 语义检索

同步相关 (Pro):
  POST   /sync/export-book                — 导出书籍数据用于本地下载
  POST   /sync/import-operations          — 提交离线操作日志
  GET    /sync/conflicts                  — 获取同步冲突列表
  POST   /sync/resolve-conflict           — 解决冲突

版本管理:
  GET    /books/:bookId/chapters/:chapterId/versions   — 版本历史列表
  GET    /versions/:versionId                           — 获取某版本完整内容
  GET    /versions/diff?left=:id1&right=:id2           — 两个版本的文本差异
  GET    /chapters/:chapterId/diff-current?compareWith=:versionId — 历史版本vs当前
  POST   /versions/:versionId/revert                   — 回退到指定版本
  PATCH  /versions/:versionId/label                    — 修改版本标签
  DELETE /versions/:versionId                          — 删除指定版本

导出:
  POST   /export/word/:bookId
  POST   /export/txt/:bookId
  POST   /export/epub/:bookId

文件:
  POST   /files/upload                    — 上传文风样本等
  GET    /files/:id/download              — 下载文件

通知:
  GET    /notifications                   — 获取通知列表（支持分页+未读过滤）
  PATCH  /notifications/:id/read          — 标记已读
  POST   /notifications/read-all          — 全部标记已读
  DELETE /notifications/:id               — 删除通知
```

---

## 11. 安全与隐私

### 11.1 数据安全架构

```
┌──────────────────────────────────────────────────────────────┐
│                       安全层次                                 │
│                                                              │
│  传输层                                                       │
│  ├── 全站 HTTPS (TLS 1.3)                                    │
│  ├── WebSocket over TLS (WSS)                                │
│  └── 证书由 Let's Encrypt 或云服务商管理                        │
│                                                              │
│  认证层                                                       │
│  ├── JWT + Refresh Token 双令牌机制                           │
│  ├── 密码 bcrypt(cost=12) 哈希                                │
│  ├── 登录失败限流 (IP级别)                                    │
│  └── 敏感操作二次验证                                         │
│                                                              │
│  授权层                                                       │
│  ├── 基于套餐等级的权限控制 (RBAC)                             │
│  ├── 资源级权限 (用户只能访问自己的数据)                        │
│  └── API端点级别的套餐校验                                     │
│                                                              │
│  数据层                                                       │
│  ├── 用户创作数据隔离 (Row-Level Security)                     │
│  ├── API Key 加密存储 (AES-256-GCM)                           │
│  ├── 数据库连接加密 (SSL)                                     │
│  ├── 自动备份 + 异地容灾                                       │
│  └── 数据库访问日志审计                                        │
│                                                              │
│  应用层                                                       │
│  ├── 输入校验与SQL注入防护                                     │
│  ├── XSS/CSRF 防护                                           │
│  ├── API速率限制 (按用户+套餐)                                 │
│  └── 请求日志与异常监控                                        │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 隐私保护原则

| 原则 | 说明 |
|------|------|
| **数据所有权** | 用户拥有其创作内容的完整版权，平台不主张任何权利 |
| **数据可移植** | Lite及以上套餐支持导出全部数据 |
| **最少收集** | 仅收集必要的账号信息（邮箱）和使用统计数据 |
| **AI数据隔离** | 用户创作内容不会用于训练AI模型（除非用户明确同意参与改进计划） |
| **数据删除权** | 用户可随时请求永久删除所有云端数据 |
| **透明度** | 隐私政策清晰说明所有数据使用方式 |

---

## 12. 开发路线图

### Phase 1: 基础框架搭建 — 预计 10-14 周

| 编号 | 任务 | 优先级 | 说明 |
|------|------|--------|------|
| P1.1 | NestJS 后端项目初始化 + PostgreSQL schema | P0 | 数据库迁移脚本 |
| P1.2 | 用户注册/登录/认证系统 (JWT) | P0 | 含邮箱验证 |
| P1.3 | Electron + React 客户端框架搭建 | P0 | 三栏布局 + 基础路由 |
| P1.4 | Tiptap 富文本编辑器集成 | P0 | 基础编辑功能 |
| P1.5 | 书籍/卷/章节 CRUD API | P0 | 含数据库访问层 |
| P1.6 | 客户端API通信层 + 云端保存/加载 | P0 | 基础同步 |
| P1.7 | AI接口对接（SSE流式生成 + 打字机） | P0 | 服务端代理模式 |
| P1.8 | 基础章纲编辑区 + 指令编辑区 UI | P0 | - |
| P1.9 | 简单的章节生成流程（章纲→正文） | P0 | 基础Prompt |
| P1.10 | 数据导出API（TXT/Word） | P1 | - |

### Phase 2: 核心创作系统 + 订阅 — 预计 10-14 周 ✅ **已完成**

> **v2.7 审计确认**: Phase 2 全部 12 项任务已完成。纲树/角色/世界观/版本管理/订阅/Token 系统均实现完整的 CRUD API + 前端对接。

| 编号 | 任务 | 状态 | 说明 |
|------|------|------|------|
| P2.1 | 大纲/卷纲/章纲 三级纲树系统 | ✅ | 含联级更新、递归删除、树形查询 |
| P2.2 | 角色档案管理系统 | ✅ | CRUD + 关系图数据API |
| P2.3 | 世界观设定管理系统 | ✅ | 按category过滤、contentVersion追踪 |
| P2.4 | 人物关系图谱（前端可视化） | ⚠️ | API已实现，前端UI未渲染图形 |
| P2.5 | 版本管理（章节版本保存/回溯） | ✅ | 自动快照、回退前保存、按套餐限制 |
| P2.6 | Prompt模板引擎（服务端） | ✅ | 章节生成+章纲生成两个模板 |
| P2.7 | 写作台管理（多书籍/多章节） | ✅ | LeftSidebar三栏布局管理 |
| P2.8 | 五级订阅套餐系统 | ✅ | shared常量 + API + PricingPage |
| P2.9 | Token购买系统 | ✅ | 增量包定义 + 购买 + 余额管理 |
| P2.10 | Token消费追踪与月度配额 | ✅ | 生成后自动扣减 + 交易记录 |
| P2.11 | 作品空间管理 | ✅ | 创建时检查配额 |
| P2.12 | 套餐权限校验中间件 | ✅ | model-router按套餐分级路由 |

### Phase 3: AI深度系统 — 预计 10-14 周 ✅ **基本完成**

> **v2.7 审计确认**: Phase 3 核心功能已实现，但存在若干降级和待完善项（详见下方已知问题）。

| 编号 | 任务 | 状态 | 说明 |
|------|------|------|------|
| P3.1 | 短期记忆系统（服务端缓存 + 摘要栈） | ✅ | assembleContext 实现四级上下文组装 |
| P3.2 | pgvector 集成 + embedding服务 | ⚠️ | embedding已实现；向量检索用JS层余弦计算而非pgvector原生SQL |
| P3.3 | 事件记忆提取与检索 | ⚠️ | 同步调用，未使用BullMQ异步队列 |
| P3.4 | 角色状态快照系统 | ✅ | 5维度快照（物理/心理/情感/位置/持有物） |
| P3.5 | 伏笔追踪器 | ✅ | 新伏笔检测+已有伏笔推进/回收+超期告警 |
| P3.6 | 世界设定补丁 + 风格锚点 | ⚠️ | 设定补丁已实现；风格锚点实体已建但提取逻辑为空 |
| P3.7 | 混合检索服务（向量+关键词+元数据） | ⚠️ | 已实现但关键词用简单分词匹配，非文档设计的FTS |
| P3.8 | 记忆管家（上下文窗口动态管理） | ✅ | MemoryService.assembleContext |
| P3.9 | 内容冲突检测 | ✅ | 伏笔超期检测+角色状态停滞检测 |
| P3.10 | Redis缓存层（热门数据 + 会话） | ✅ | CacheService双模式（Redis优先/内存回退） |

**已知问题（v2.7审计发现）**:
- 🔴 **流式生成路径丢失记忆上下文**: `ai.controller.ts` 的 SSE 流式端点未调用 `assembleContext`，当前所有前端触发的章节生成均未注入记忆
- 🔴 **assembleContext 返回的4个字段仅使用2个**: `characterStates` 和 `relevantMemories` 被丢弃
- 🟡 **向量检索为JS层全量计算**: 未使用 pgvector 原生 SQL 检索，长篇作品性能会线性退化
- 🟡 **全文搜索降级**: 文档设计的 `ts_rank` + `zhparser` 中文分词未实现，仅用简单关键词匹配
- 🟡 **物品/货币追踪未实现**: 文档设计中的物品追踪功能代码中不存在

### Phase 4: Agent系统 — 预计 8-12 周 ✅ **基本完成**

> **v2.7 审计确认**: 5个Agent + Orchestrator全部实现，但Agent系统与记忆系统完全隔离。

| 编号 | 任务 | 状态 | 说明 |
|------|------|------|------|
| P4.1 | 工作管家（Orchestrator）框架 | ✅ | 注册/调度/并行执行/预处理/后处理 |
| P4.2 | 架构师Agent | ✅ | 章纲优化，lite+ |
| P4.3 | 人设师Agent | ✅ | 角色创建/管理，basic+ |
| P4.4 | 世界构建师Agent | ✅ | 世界观补全，plus+ |
| P4.5 | 文风模拟师Agent | ✅ | 文风分析，pro+ |
| P4.6 | 质检员Agent | ✅ | 异步质量审核，basic+ |
| P4.7 | 多模型路由器 | ✅ | Flash/Pro按套餐+任务路由 |
| P4.8 | AI去味审查系统 | ✅ | 检测+润色+差异对比 |

**已知问题（v2.7审计发现）**:
- 🔴 **Agent系统与记忆系统完全隔离**: 5个Agent的 `buildPrompt()` 均零引用记忆服务
- 🔴 **Orchestrator未调用记忆管家**: 文档设计的 "Orchestrator → 记忆管家 → 文风模拟师 → 架构师 → 组装Prompt" 完整流水线未实现
- 🟡 **Agent Prompt过于简单**: 未注入角色列表/世界观设定/活跃伏笔等上下文

### Phase 5: 离线模式 + 同步 — 预计 8-12 周 ⚠️ **部分完成**

> **v2.7 审计确认**: 同步基础设施已建立，但离线模式核心功能未实现。

| 编号 | 任务 | 状态 | 说明 |
|------|------|------|------|
| P5.1 | 数据下载服务（云端→本地） | ⚠️ | 数据包导出API已实现，但非文件格式 |
| P5.2 | 作品空间管理（清空/释放空间） | ✅ | 创建时配额检查已实现 |
| P5.3 | 客户端本地SQLite数据库 | ❌ | 未实现 |
| P5.4 | 离线操作日志系统 | ✅ | operation-log实体+导入API实现 |
| P5.5 | 增量同步引擎 | ⚠️ | 冲突检测已实现；实际回写未实现 |
| P5.6 | 同步冲突解决UI | ⚠️ | API已实现；前端UI未对接 |
| P5.7 | WebSocket实时同步 (Socket.io) | ❌ | 未实现 |
| P5.8 | 离线模式状态指示UI | ❌ | 未实现 |

### Phase 6: 高级功能与体验优化 — 预计 8-12 周 ⚠️ **部分完成**

> **v2.8 审计确认**: Token购买UI、主题切换已完成；全局搜索为客户端过滤而非FTS；通知系统未实现。纲树-章节同步系统已设计，待实现。

| 编号 | 任务 | 状态 | 说明 |
|------|------|------|------|
| P6.1 | Token购买UI + 余额展示 | ✅ | PricingPage + StatusBar |
| P6.2 | 素材灵感库 | ❌ | 未实现 |
| P6.3 | 名称批量生成与查重 | ❌ | 未实现 |
| P6.4 | 全局搜索（FTS全文索引） | ⚠️ | 已实现客户端过滤搜索，非FTS |
| P6.5 | 插件系统基础架构 | ❌ | 未实现 |
| P6.6 | UI/UX 全面优化 | ⚠️ | 基础动画已实现 |
| P6.7 | 快捷键系统 | ⚠️ | 编辑器基础快捷键已实现 |
| P6.8 | 深色/浅色主题 | ✅ | 亮/暗/跟随系统三模式 |
| P6.9 | 通知系统（WebSocket推送 + 邮件） | ❌ | 未实现 |
| P6.10 | 纲树-章节同步系统 | 🔧 | 数据模型+API+UI设计完成，待落地 (v2.8) |
| P6.10 | 自动更新（客户端） | ❌ | Electron外壳未集成 |

### Phase 7: 打磨与发布 — 预计 6-8 周 🔧 **未开始**

| 编号 | 任务 | 状态 | 说明 |
|------|------|------|------|
| P7.1 | 性能优化（大文本/数据库查询/API响应） | ❌ | 未开始 |
| P7.2 | 500万字级超长文本压力测试 | ❌ | 未开始 |
| P7.3 | 并发用户压力测试 | ❌ | 未开始 |
| P7.4 | 安全渗透测试 | ❌ | 未开始 |
| P7.5 | Windows 打包与测试 | ❌ | 未开始 |
| P7.6 | macOS 打包与测试 | ❌ | 未开始 |
| P7.7 | 安装包签名与公证 | ❌ | 未开始 |
| P7.8 | 服务端生产部署（Docker/K8s） | ❌ | 未开始 |
| P7.9 | 监控告警系统（Prometheus + Grafana） | ❌ | 未开始 |
| P7.10 | 用户文档/API文档编写 | ❌ | 未开始 |

---

> **开发进度汇总 (v2.7)**: Phase 1-2 全部完成 (24/24)。Phase 3 核心功能到位但存在降级实现 (10/10 基本完成)。Phase 4 Agent系统全部实现但与记忆系统未联网 (8/8 基本完成)。Phase 5-6 约 50% 完成。Phase 7 未开始。详见 [第19章 完善方案](#19-完善方案)。

---

## 13. 附录

### 13.1 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 云端优先 | Cloud-First | 所有数据默认存储在云端，本地仅作缓存 |
| 纲树 | Outline Tree | 大纲/卷纲/章纲的三级树形结构 |
| 写作台 | Writing Desk | 管理多本书籍和章节的工作区 |
| 记忆管家 | Memory Orchestrator | 负责组装工作记忆的协调模块 |
| 工作管家 | Work Orchestrator | 负责Agent任务分配与协调 |
| 风格锚点 | Style Anchor | 文风特征的向量化记忆 |
| 伏笔追踪器 | Foreshadowing Tracker | 管理伏笔生命周期的模块 |
| 打字机效果 | Typewriter Effect | AI流式生成的逐字显示效果 |
| Gist摘要 | Gist Summary | 对长文本的极度压缩摘要 |
| 操作日志 | Operation Log | 离线模式下记录本地变更的日志，用于增量同步 |
| 同步冲突 | Sync Conflict | 云端和本地对同一数据做了不同修改时的状态 |

### 13.2 API服务配置

（与v1.0 10.2节一致。）

### 13.3 模型推荐（按任务）

（与v1.0 10.3节一致。）

### 13.4 关键技术风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 超长上下文模型API成本 | 运营成本高 | 分级模型策略 + 用量限额 + 缓存复用 |
| 500万字文本的数据库性能 | 查询变慢 | PostgreSQL分区表 + FTS全文索引 + 读写分离 |
| pgvector大量向量检索性能 | 记忆召回延迟 | IVF索引 + 合理设置lists + 定期索引重建 |
| 同步冲突处理复杂度 | 用户体验差 | 乐观锁 + 自动合并 + 清晰的冲突解决UI |
| 服务端高并发压力 | 服务不可用 | 水平扩展 + 限流 + 熔断 + Redis缓存 |
| 数据安全与隐私 | 用户信任危机 | 加密传输 + 数据隔离 + 定期安全审计 |
| 支付系统集成 | 资金损失 | 服务端验签 + 幂等处理 + 对账机制 |
| 跨平台兼容性 | 平台差异Bug | CI/CD多平台自动化测试 |

### 13.5 开发环境配置指南

```bash
# 前置要求
Node.js >= 20.0.0
pnpm >= 8.0.0
Docker Desktop (用于本地PostgreSQL + Redis)

# 克隆项目
git clone <repo-url> novel-writing-assistant
cd novel-writing-assistant

# 安装依赖 (Monorepo)
pnpm install

# 启动本地数据库和缓存
docker compose up -d postgres redis

# 初始化数据库 (运行迁移)
cd server
pnpm migration:run
pnpm seed          # 填充种子数据

# 启动后端服务
pnpm start:dev     # http://localhost:3000

# 启动客户端 (另一个终端)
cd client
pnpm dev           # Electron开发模式

# 全栈开发 (根目录)
pnpm dev           # 同时启动前后端
```

---




---


---

## 14. 产品管理补充

### 14.1 用户故事 (User Stories)

#### 14.1.1 网文作者（新手）

| 编号 | 用户故事 | 验收标准 | 优先级 |
|------|---------|---------|--------|
| US-001 | 作为一位刚开始写网文的新手，我希望系统能根据我简单的几个想法（主角名+金手指+世界观关键词），**自动生成一份完整的大纲和前三章正文**，以便我能快速开始创作，克服"空白页恐惧症"。 | 输入≤100字的创意描述，5分钟内生成大纲(≥500字) + 章纲(≥3章) + 第一章正文(≥2000字) | P0 |
| US-002 | 作为一位对网文套路不熟悉的新手，我希望系统提供**常见网文流派模板**（如都市异能、仙侠修真、游戏异界等），以便我能参考成熟的结构快速搭建自己的故事框架。 | 提供≥10种流派预设模板，每个模板包含：典型世界观设定、常见金手指类型、推荐大纲结构、3个示例开头 | P1 |
| US-003 | 作为一位担心写崩的新手，我希望AI能在我的创作过程中**实时提示可能的设定矛盾和角色OOC风险**，以便我及时修正，保持故事的内部一致性。 | 在用户写作/生成时，侧栏自动展示潜在冲突（若有），点击可查看详情和修改建议 | P1 |

#### 14.1.2 网文作者（资深/全职）

| 编号 | 用户故事 | 验收标准 | 优先级 |
|------|---------|---------|--------|
| US-004 | 作为一位日更万字以上的全职作者，我希望系统能**记住我整本书的所有设定、角色状态和伏笔**，在每次生成新章节时自动注入相关上下文，以便我不需要反复翻查前文，专注于剧情推进。 | 记忆系统覆盖≥200万字的上下文，单次生成请求的上下文组装耗时<2秒 | P0 |
| US-005 | 作为一位追求个人风格的作者，我希望AI能**学习我已有作品的文风**，包括用词习惯、句式节奏、对话风格等，使生成的文字与我手写的内容无缝融合。 | 上传≥1本参考作品(≥5万字)后，风格模仿度评分≥80%（由独立评估模型判定），用户盲测区分AI/人写章节的准确率<60% | P0 |
| US-006 | 作为一位需要批量产出的作者，我希望一次能**并行生成多个章节的不同版本**，并从中选择或组合最佳内容，以提高创作效率。 | Pro套餐支持9个并行槽位同时生成，每个槽位独立可暂停/继续/废弃 | P0 |

#### 14.1.3 读者/内容消费者（间接用户）

> 注：读者为本产品的间接受益者，其需求通过影响作者创作质量来体现。

| 编号 | 用户故事 | 对应产品功能 |
|------|---------|------------|
| US-007 | 作为读者，我希望AI辅助创作的小说的**情节不出现明显Bug和设定矛盾**，阅读体验与纯人类创作无差异。 | AI去味审查 + 记忆系统冲突检测 |
| US-008 | 作为读者，我希望AI辅助创作的小说角色**性格鲜明且前后一致**，不会出现"人设崩塌"。 | 角色状态快照系统 + 角色一致性检查 |
| US-009 | 作为读者，我无法接受明显的**AI生成痕迹**（如重复句式、生硬过渡、情感空洞），希望文字有"人味儿"。 | AI去味审查功能 (Basic及以上套餐) |

### 14.2 功能优先级矩阵

| 功能模块 | 优先级 | 实现难度 | 用户价值 | 技术依赖 | 建议阶段 |
|---------|--------|---------|---------|---------|---------|
| 用户注册/登录/认证 | P0 | 低 | 高 | 无 | Phase 1 |
| 基础文本编辑器 (Tiptap) | P0 | 中 | 高 | 无 | Phase 1 |
| 书籍/卷/章节 CRUD | P0 | 低 | 高 | 用户认证 | Phase 1 |
| AI单次章节生成 (SSE流式) | P0 | 中 | 极高 | AI接口对接 | Phase 1 |
| 三级纲树系统 | P0 | 中 | 高 | 章节CRUD | Phase 2 |
| 订阅套餐系统 | P0 | 中 | 核心商业模式 | 用户认证 + 支付 | Phase 2 |
| Token购买与消费追踪 | P0 | 中 | 核心商业模式 | 订阅系统 | Phase 2 |
| 套餐权限校验中间件 | P0 | 低 | 高 | 订阅系统 | Phase 2 |
| 角色档案管理 | P0 | 中 | 高 | 书籍CRUD | Phase 2 |
| 世界观设定管理 | P0 | 中 | 高 | 书籍CRUD | Phase 2 |
| Prompt模板引擎 | P0 | 中 | 高 | AI接口 | Phase 2 |
| 版本管理 (章节快照) | P1 | 低 | 中 | 章节CRUD | Phase 2 |
| 短期记忆系统 (缓存+摘要) | P0 | 高 | 极高 | Redis + LLM | Phase 3 |
| pgvector向量记忆 | P0 | 高 | 极高 | PostgreSQL | Phase 3 |
| 事件记忆提取与检索 | P0 | 高 | 极高 | pgvector + BullMQ | Phase 3 |
| 角色状态快照系统 | P0 | 中 | 高 | 角色系统 | Phase 3 |
| 伏笔追踪器 | P0 | 中 | 高 | 事件记忆 | Phase 3 |
| 混合检索服务 | P0 | 高 | 极高 | pgvector + FTS | Phase 3 |
| 工作管家 (Orchestrator) | P0 | 高 | 极高 | 记忆系统 + AI | Phase 4 |
| 架构师Agent (大纲生成) | P0 | 高 | 高 | Orchestrator | Phase 4 |
| 质检员Agent | P0 | 中 | 高 | Orchestrator | Phase 4 |
| AI去味审查系统 | P0 | 高 | 极高 | 质检员Agent | Phase 4 |
| 人设师Agent | P0 | 中 | 高 | Orchestrator | Phase 4 |
| 文风模拟师Agent | P1 | 高 | 高 | Orchestrator | Phase 4 |
| 世界构建师Agent | P1 | 高 | 中 | Orchestrator | Phase 4 |
| 多模型路由器 | P0 | 中 | 高 | AI接口 | Phase 4 |
| 离线数据下载 | P0 | 高 | 高 (Lite+) | 同步引擎 | Phase 5 |
| 本地SQLite数据库 | P0 | 中 | 高 (Lite+) | 数据下载 | Phase 5 |
| 增量同步引擎 | P0 | 高 | 高 | 操作日志 + 冲突解决 | Phase 5 |
| 同步冲突解决UI | P0 | 中 | 高 | 同步引擎 | Phase 5 |
| WebSocket实时同步 | P0 | 中 | 高 | Socket.io | Phase 5 |
| Token购买UI | P0 | 低 | 高 | Token系统 | Phase 6 |
| 人物关系图谱 (D3.js) | P1 | 中 | 中 | 角色系统 | Phase 6 |
| 素材灵感库 | P2 | 低 | 中 | 无 | Phase 6 |
| 全局搜索 (FTS) | P2 | 中 | 中 | PostgreSQL FTS | Phase 6 |
| 深色/浅色主题 | P2 | 低 | 中 | Tailwind | Phase 6 |
| 通知系统 | P2 | 中 | 中 | WebSocket + 邮件 | Phase 6 |
| 快捷键系统 | P2 | 低 | 中 | 无 | Phase 6 |
| 插件系统 | P3 | 高 | 中 (高级用户) | 稳定API | 远期 |
| 自动更新 (electron-updater) | P1 | 低 | 高 | Electron | Phase 6 |

**优先级定义**:
- **P0**: 必须实现 — 产品MVP和核心价值的基础，缺少则产品不可用
- **P1**: 应该实现 — 显著提升用户体验和产品竞争力，应在正式发布前完成
- **P2**: 可以延迟 — 锦上添花，可在发布后迭代添加
- **P3**: 远期规划 — 在核心功能稳定后再考虑

### 14.3 核心用户旅程 (User Journeys)

#### 14.3.1 新用户引导流程：从注册到第一个章节生成

```
用户首次打开软件
        │
        ▼
┌─────────────────────────────────────────┐
│ 步骤 1: 欢迎页面                          │
│ ┌─────────────────────────────────────┐ │
│ │ 🎉 欢迎来到 AI 智能小说生成助手       │ │
│ │                                     │ │
│ │ [快速开始] → 选择流派模板              │ │
│ │ [导入已有作品] → 上传文件               │ │
│ │ [探索功能] → 进入空工作台              │ │
│ └─────────────────────────────────────┘ │
└───────────────────┬─────────────────────┘
                    │ (选择"快速开始")
                    ▼
┌─────────────────────────────────────────┐
│ 步骤 2: 注册/登录                         │
│ · 邮箱注册 (用户名 + 邮箱 + 密码)          │
│ · 或 OAuth 快捷登录 (Google/微信/GitHub)   │
│ · 默认开通 Free 套餐，无需支付             │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ 步骤 3: 选择流派与模板                     │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│ │仙侠│ │都市│ │科幻│ │历史│ │奇幻│ ...   │
│ └────┘ └────┘ └────┘ └────┘ └────┘    │
│                                         │
│ 每个流派提供:                             │
│ · 典型世界观设定模板                       │
│ · 常见金手指/系统类型                      │
│ · 推荐大纲结构                            │
│ · 示例角色模板                            │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ 步骤 4: 基本信息填写 (引导式)              │
│                                         │
│ 📖 作品名称: [_______________]            │
│ 👤 主角姓名: [_______________]            │
│ ⚡ 金手指/系统: [_______________] (可选)   │
│ 🌍 世界观简述: [_______________] (可选)    │
│ 📝 一句话简介: [_______________]          │
│                                         │
│ 💡 提示: 如果暂时没有想法，可以留空，      │
│    AI会根据流派模板自动生成初始设定。       │
│                                         │
│ [帮我生成初始设定]  [我自己填写详细设定]    │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ 步骤 5: AI生成初始设定 (SSE流式展示)       │
│                                         │
│ ⏳ AI正在为您创作:                        │
│  ├── ✅ 世界观框架 ● 已完成                │
│  ├── 🔄 主要角色设定 ● 生成中...           │
│  ├── ⏳ 大纲规划 ● 等待中                  │
│  └── ⏳ 第一章章纲 ● 等待中                │
│                                         │
│ 用户可实时查看生成进度，随时暂停/调整       │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ 步骤 6: 审阅与调整                        │
│                                         │
│ 左侧: AI生成的设定 + 大纲                 │
│ 右侧: 编辑面板，可逐项修改                 │
│                                         │
│ 用户可以:                                │
│ · 接受全部 → 进入下一步                   │
│ · 逐项修改 → 调整设定/大纲/角色            │
│ · 重新生成 → 更换随机种子重新创作          │
│ · 追加指令 → "让主角更腹黑一些"            │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ 步骤 7: 生成第一章正文                     │
│                                         │
│ 中央: 正文编辑器 (Tiptap)                 │
│ 右侧: 章纲对照 + 指令输入                  │
│ 底部: AI生成控制栏                        │
│                                         │
│ [生成第一章] → SSE流式输出，打字机效果      │
│                                         │
│ ✨ 完成! 弹出引导提示:                     │
│ "恭喜完成第一章！您可以继续生成第二章，      │
│  或探索更多功能：[大纲管理] [角色管理]      │
│  [AI去味审查]"                            │
└─────────────────────────────────────────┘
```

**关键设计原则**:
- 每一步都有"跳过"或"使用默认值"选项，不强迫用户填写
- AI生成的每个阶段都实时可视，让用户感到"有进展"
- 每一步都提供"返回上一步修改"的能力
- 首次使用全程不超过15分钟即可看到第一段正文

#### 14.3.2 老用户继续创作流程（500万字级长篇小说）

```
用户打开软件
        │
        ▼
┌─────────────────────────────────────────┐
│ 步骤 1: 自动恢复上次会话                   │
│ · 自动登录 (令牌有效期内)                  │
│ · 自动打开上次编辑的书籍和章节              │
│ · 恢复编辑器光标位置                      │
│ · 同步状态检查 (Lite+套餐)                │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ 步骤 2: 上下文快速加载                     │
│                                         │
│ 后台异步加载 (用户无感知):                  │
│ ├── 当前章节前3章 + 后章纲 (短期上下文)     │
│ ├── 角色当前状态摘要 (从缓存)              │
│ ├── 活跃伏笔列表 (从缓存)                  │
│ ├── 最近关键事件摘要 (从缓存)              │
│ └── 当前卷大纲 (从缓存)                    │
│                                         │
│ 加载耗时目标: < 3秒                       │
│                                         │
│ 底部状态栏显示: ☁ 已同步 | 📊 总字数: 387万  │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ 步骤 3: 创作决策                           │
│                                         │
│ 用户在左侧纲树查看当前进度:                 │
│                                         │
│ 📚 仙道巅峰 (387万字)                     │
│  ├ 📖 第一卷: 凡尘剑歌 (已完成 ✓)          │
│  ├ 📖 第二卷: 仙门风云 (已完成 ✓)          │
│  │   ...                                 │
│  ├ 📖 第八卷: 天道之争 (进行中 ⟳)          │
│  │   ├ 第451章: 初入天门 (已完成 ✓)        │
│  │   ├ 第452章: 天道试炼 (已完成 ✓)        │
│  │   ├ 第453章: 破境之战 (已完成 ✓)        │
│  │   ├ 第454章: ___ (当前 ✎)              │
│  │   └ 第455章~458章 (章纲已生成 📋)      │
│  └ 📖 第九卷: ___ (规划中 📝)              │
│                                         │
│ 用户可:                                  │
│ · 点击已有章节 → 阅读/修改                 │
│ · 点击"当前"章 → 继续写作                  │
│ · 点击章纲 → 预览 → 一键生成正文            │
│ · 使用全局搜索 → 查找"某个角色/事件"        │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ 步骤 4: AI辅助创作                         │
│                                         │
│ 右侧面板:                                │
│ ┌─────────────────────────────────────┐ │
│ │ 📋 当前章纲                          │ │
│ │ "陈凡踏入天道殿，发现殿中已有三位       │ │
│ │  强者——他们分别代表了..."             │ │
│ │                                     │ │
│ │ 📝 自定义指令                        │ │
│ │ "这章需要描写陈凡与三位强者的初次     │ │
│ │  交锋，突出他的从容不迫。"            │ │
│ │                                     │ │
│ │ ⚠ 记忆提示 (自动)                    │ │
│ │ · 陈凡当前修为: 大罗金仙后期          │ │
│ │ · 持有法宝: 混沌钟(完整)、弑神枪(残)   │ │
│ │ · 未解伏笔: #12-天道的真实身份        │ │
│ │ · 关联角色: 青鸾(重伤中)、白泽(已陨)  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [生成第454章正文] 按钮 → 开始SSE流式生成   │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ 步骤 5: AI生成 + 实时交互                  │
│                                         │
│ 中央编辑器: 正文逐字出现 (打字机效果)       │
│ 底部控制栏:                               │
│ [⏸ 暂停] [▶ 继续] [🔄 重试] [✏ 手动续写] │
│                                         │
│ 生成完成后自动:                           │
│ 1. 质检员Agent异步审查 → 结果推送到通知    │
│ 2. 记忆提取管道异步处理                    │
│ 3. (Basic+) AI去味审查自动触发            │
│ 4. 字数统计更新                          │
└─────────────────────────────────────────┘
```

#### 14.3.3 AI去味审查交互流程

```
用户完成章节生成 (或手动触发审查)
        │
        ▼
┌─────────────────────────────────────────┐
│ 步骤 1: 触发审查                          │
│                                         │
│ 触发方式:                                │
│ · 自动: 每章生成完成后自动触发 (Basic+)    │
│ · 手动: 编辑器工具栏 "🔍 AI去味审查" 按钮  │
│ · 批量: 纲树中多选章节 → 右键 → 批量审查   │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ 步骤 2: 审查进度展示                       │
│                                         │
│ 底部状态栏显示进度:                        │
│ 🔍 AI味检测中... 45%                     │
│                                         │
│ 通知中心:                                │
│ ┌─────────────────────────────────────┐ │
│ │ 🔍 第454章 AI去味审查                  │ │
│ │                                     │ │
│ │ AI味指数: 72/100 ⚠ (偏高)             │ │
│ │ 检测到 15 处需要优化                   │ │
│ │                                     │ │
│ │ [查看详情]  [一键全部润色]  [忽略]     │ │
│ └─────────────────────────────────────┘ │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ 步骤 3: 差异对比视图 (核心交互)            │
│                                         │
│ ┌──────────────┬─────────────────────┐ │
│ │  原文 (左侧)   │  润色建议 (右侧)      │ │
│ ├──────────────┼─────────────────────┤ │
│ │              │                     │ │
│ │ "他不仅感觉  │ "他心中涌起一股      │ │
│ │  到愤怒，而  │  怒意，拳头不由      │ │
│ │  且还有一种  │  自主地攥紧。可      │ │
│ │  深深的无力  │  是——他又能做什么     │ │
│ │  感。这让他  │  呢？那股无力感      │ │
│ │  意识到自己  │  像潮水一样漫上      │ │
│ │  的弱小。"   │  来，淹没了所有      │ │
│ │              │  的挣扎。"          │ │
│ │              │                     │ │
│ │  标注:       │  修改原因:           │ │
│ │  🔴 句式重复  │  "不仅...而且..."    │ │
│ │  🟡 情感直白  │  改为动作+内心独白   │ │
│ │  🟢 过度解释  │  删除"这让他意识到   │ │
│ │              │   自己的弱小"       │ │
│ │              │                     │ │
│ │              │  [接受此修改 ✓]      │ │
│ │              │  [拒绝此修改 ✗]      │ │
│ │              │  [微调... 🔧]       │ │
│ ├──────────────┴─────────────────────┤ │
│ │ 进度: 修改 3/15  ◀ 上一处  下一处 ▶  │ │
│ │                                     │ │
│ │ [全部接受]  [全部拒绝]  [逐条审查]     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**差异对比UI设计要点**:
- **左右分栏**: 原文在左，润色建议在右，一目了然
- **颜色标注**: 红色(句式问题)、黄色(情感问题)、绿色(过度解释)、蓝色(对话问题)
- **修改原因**: 每处修改都附带简短的可理解原因，帮助用户学习和理解
- **逐条决策**: 默认逐条审查，支持键盘快捷键 (← 拒绝, → 接受, ↑↓ 切换)
- **一键操作**: 提供"全部接受"和"全部拒绝"快捷选项
- **去味强度调节**: 在处理开始前可调节强度(1-10)，不同强度对应不同的修改激进程度
- **AI味指数可视化**: 处理完成后展示处理前后的AI味指数对比，用仪表盘图表直观展示

### 14.4 竞品分析

| 维度 | 本产品 | Sudowrite | NovelAI | Jasper | 阅文作家助手 |
|------|--------|-----------|---------|-------|------------|
| **目标用户** | 中文网文作者 | 英文小说作者 | 二次元/同人创作者 | 营销文案写手 | 网文作者(阅文生态) |
| **核心能力** | 超长篇小说(500万字)结构化创作 + 多Agent协作 | 中短篇小说辅助创作 | AI故事生成 + 图片生成 | 营销文案批量生成 | 基础写作辅助 |
| **长篇能力** | ⭐⭐⭐⭐⭐ 专为超长篇设计，三级记忆架构 | ⭐⭐⭐ 中等，依赖模型上下文 | ⭐⭐ 偏短篇/章节 | ⭐ 不适合长文本 | ⭐⭐⭐ 阅文平台经验 |
| **文风定制** | ⭐⭐⭐⭐⭐ 上传作品学习个人文风，支持混合风格 | ⭐⭐⭐ 预设风格调整 | ⭐⭐ 有限 | ⭐⭐⭐ 品牌语调定制 | ⭐ 有限 |
| **一致性保障** | ⭐⭐⭐⭐⭐ 角色状态快照 + 伏笔追踪 + 设定冲突检测 | ⭐⭐ 依赖模型记忆 | ⭐⭐ 基础 | ⭐ 不适用 | ⭐⭐ 基础 |
| **离线能力** | ⭐⭐⭐⭐ Lite+套餐支持完整离线创作+增量同步 | ⭐ 纯云端 | ⭐ 纯云端 | ⭐ 纯云端 | ⭐ 需联网 |
| **AI去味** | ⭐⭐⭐⭐⭐ 7维度检测 + 人性化润色 + 差异对比 | ⭐⭐ 基础 | ⭐ 无 | ⭐ 无 | ⭐ 无 |
| **商业模式** | 五级订阅 + Token增量包 | 月费订阅 | 月费 + Token | 月费 | 免费(阅文生态内) |
| **平台** | Windows + macOS 桌面端 | Web | Web | Web | Web + 移动端 |
| **中文支持** | ⭐⭐⭐⭐⭐ 原生中文，中文分词+FTS | ⭐⭐ 有限 | ⭐ 有限 | ⭐⭐ 翻译级别 | ⭐⭐⭐⭐⭐ 原生中文 |

**本产品核心差异化优势**:

1. **超长篇专业能力**: 市场上唯一专为"500万字级"网文创作设计的产品，三级记忆架构解决了超长篇创作的上下文管理难题，这是当前所有竞品都无法做到的。

2. **AI去味审查**: 围绕"让AI生成内容读起来像人写的"这一核心痛点，建立了完整的7维度检测+人性化润色+差异对比体系。这是网文赛道最关键的技术壁垒之一。

3. **文风深度定制**: 支持上传用户自己的作品进行文风学习，不仅可以模仿，还能混合多种风格，让AI生成内容与作者手写内容无缝融合。

4. **离线创作+增量同步**: 桌面端原生应用支持完整的离线创作体验，联网后智能增量同步，兼顾了数据安全和创作自由。

5. **桌面端原生体验**: 相比Web竞品，桌面应用提供更流畅的编辑体验、系统级快捷键、本地文件系统访问、以及更低的延迟。

**市场定位**:

```
                   高
                    ↑
    AI能力/复杂     │   ★ 本产品 (专业长篇AI写作)
    AI能力/复杂     │
                    │       Sudowrite
                    │   NovelAI
                    │           Jasper
                    │  阅文作家助手
                    │
                    └─────────────────────→ 高
                    低       文本长度能力
```

### 14.5 产品指标与成功标准

#### 14.5.1 北极星指标 (North Star Metric)

> **"月活跃创作者完成的AI辅助章节数"**

该指标同时衡量产品的用户活跃度和AI能力的实际使用价值。一个"完成的章节"定义为：AI生成后用户进行了至少一次编辑操作（接受、修改或保存）的章节。

**目标**: 正式发布12个月后，月活创作者完成≥100万章/月。

#### 14.5.2 分层指标体系

**第一层：获客指标**
| 指标 | 定义 | 目标 (12个月) |
|------|------|------------|
| 官网月访问量 | 官网独立访客数 | ≥50万 |
| 注册转化率 | 注册用户/官网访客 | ≥15% |
| 下载-激活率 | 打开软件/下载安装 | ≥70% |

**第二层：激活指标**
| 指标 | 定义 | 目标 |
|------|------|------|
| 首次创作完成率 | 注册后7天内生成并保存至少1个章节的用户占比 | ≥60% |
| 激活时间 (TTFV) | 从注册到生成第一个章节的中位数时间 | <30分钟 |
| Onboarding完成率 | 完成引导流程全部步骤的用户占比 | ≥80% |

**第三层：留存指标**
| 指标 | 定义 | 目标 |
|------|------|------|
| 次日留存 | D1回访率 | ≥50% |
| 7日留存 | D7回访率 | ≥35% |
| 30日留存 | D30回访率 | ≥25% |
| 周活跃天数 | 每周至少打开一次软件的用户，平均使用天数 | ≥4天/周 |

**第四层：付费指标**
| 指标 | 定义 | 目标 |
|------|------|------|
| Free→付费转化率 | 付费用户/总注册用户 | ≥8% |
| 月费 ARPU | 月总收入/月活付费用户数 | ≥¥80 |
| Token增量包购买率 | 购买Token增量包的用户/付费用户 | ≥30% |
| 用户生命周期价值 (LTV) | 用户从注册到流失的总付费金额 | ≥¥800 (12个月) |
| 月流失率 | 取消订阅的用户/月初付费用户 | <5% |

**第五层：AI生成质量指标**
| 指标 | 定义 | 目标 |
|------|------|------|
| 生成接受率 | 用户直接接受(未修改)的生成段落/总生成段落 | 30-50% (过高说明缺乏改进动力) |
| 修改率 | 用户修改后接受的段落/总生成段落 | 40-55% (期望的主要使用模式) |
| 拒绝率 | 用户拒绝的生成段落/总生成段落 | 5-15% |
| AI味指数均值 | 所有生成章节的AI味检测评分均值 (0-100，越低越好) | <40 |
| 用户盲测通过率 | 用户无法区分AI生成/人类写作段落的盲测比例 | >70% |
| 一致性违规率 | 生成内容中出现设定矛盾或角色OOC的比例 | <3% |

**第六层：技术性能指标**
| 指标 | 定义 | 目标 |
|------|------|------|
| 章节生成P50延迟 | 生成3000字章节的时间中位数 | <45秒 |
| 章节生成P95延迟 | 生成3000字章节的时间95分位数 | <120秒 |
| API可用性 | 后端服务可用时间占比 | ≥99.9% |
| 同步延迟 (P95) | 本地修改到云端确认的时间 | <3秒 |
| 首次内容绘制 (桌面端) | 打开软件到显示编辑器内容的时间 | <2秒 |

### 14.6 用户引导与教育系统

#### 14.6.1 分阶段引导策略

```
Phase 1: 欢迎引导 (首次启动)
  ├── 欢迎动画 (3秒，可跳过)
  ├── 注册/登录
  ├── 偏好问卷 (3-5个问题，可跳过):
  │   ├── 写作经验: [新手] [有经验] [老手]
  │   ├── 感兴趣的流派: [多选]
  │   ├── 创作目标: [写完第一本] [日更3千] [冲击精品]
  │   └── 从哪里了解到我们: [选项]
  └── → 进入快速开始流程

Phase 2: 功能发现 (渐进式揭示)
  规则: 不在首次使用时展示所有功能，而是根据用户行为逐步揭示
  
  触发时机              展示内容
  ─────────────────     ──────────────────────────
  首次打开编辑器         → Tooltip: "点击这里开始写作，或输入指令让AI帮你"
  首次生成章节后         → Tooltip: "左侧纲树可以看到你的创作结构"
  生成了3个章节后        → Tooltip: "试试AI去味审查，让文字更有'人味儿'"
  角色数达到5个后        → Tooltip: "检查角色关系图谱，避免人设冲突"
  总字数超过10万字后     → Tooltip: "你的伏笔追踪器已激活，可以在设定面板查看"
  首次断网尝试编辑时     → Guide: 离线模式说明 (Lite+套餐)

Phase 3: 进阶教育 (主动学习)
  · 帮助菜单 → "创作教程":
    ├── 视频教程: "如何用AI大纲规划一本500万字的小说"
    ├── 视频教程: "AI去味审查: 让AI写作更像你自己"
    ├── 视频教程: "文风模仿: 让AI学会你的笔触"
    ├── 最佳实践: "网文创作的节奏控制与AI协作"
    └── 案例分享: "使用本工具完成的第一本精品小说"
  
  · 写作台 → "每日写作提示":
    每次打开软件随机展示一条创作技巧
```

#### 14.6.2 帮助系统设计

```
帮助入口:
├── F1: 打开上下文感知的帮助面板（根据当前操作显示相关帮助）
├── 帮助菜单: 完整帮助文档 + 视频教程 + FAQ
├── 搜索栏: Ctrl+K 全局命令面板（含帮助搜索）
├── 社区: 官网论坛 / Discord / QQ群
└── 反馈: Help → 反馈问题 (自动附带日志和截图)

帮助面板 (F1 侧边弹出):
┌──────────────────────────────────┐
│ 🔍 [搜索帮助内容...]              │
│                                  │
│ 📖 相关帮助 (基于当前操作)         │
│ ├── 如何编写有效的章纲指令？       │
│ ├── 大纲/卷纲/章纲的区别和用法     │
│ └── 记忆提示的含义和使用方法       │
│                                  │
│ 🎬 推荐视频教程                   │
│ ├── "3分钟学会高效使用AI生成"      │
│ └── "角色管理的正确姿势"          │
│                                  │
│ ❓ 常见问题                       │
│ ├── AI生成的内容可以直接商用吗？   │
│ ├── Token用完了怎么办？           │
│ └── 如何保证角色不写崩？          │
│                                  │
│ 📞 还需要帮助？                   │
│ [联系技术支持] [社区提问]          │
└──────────────────────────────────┘
```

---

## 15. 软件架构补充

### 15.1 事件驱动架构 (Event-Driven Architecture)

#### 15.1.1 系统事件总线

```
                          ┌───────────────────────────┐
                          │    Redis Pub/Sub (事件总线)  │
                          └───────────┬───────────────┘
                                      │
        ┌─────────────┬───────────────┼───────────────┬─────────────┐
        │             │               │               │             │
        ▼             ▼               ▼               ▼             ▼
   ┌─────────┐  ┌─────────┐   ┌──────────┐   ┌──────────┐  ┌──────────┐
   │ AI编排   │  │ 记忆系统 │   │ 通知服务  │   │ 同步服务  │  │  审计日志 │
   │ 服务     │  │ 服务     │   │          │   │          │  │          │
   └─────────┘  └─────────┘   └──────────┘   └──────────┘  └──────────┘
```

#### 15.1.2 核心事件定义

```typescript
// shared/events/event-types.ts

enum EventType {
  // === 创作生命周期 ===
  BOOK_CREATED = 'book.created',
  BOOK_UPDATED = 'book.updated',
  BOOK_DELETED = 'book.deleted',
  CHAPTER_CREATED = 'chapter.created',
  CHAPTER_UPDATED = 'chapter.updated',
  CHAPTER_DELETED = 'chapter.deleted',
  CHAPTER_PUBLISHED = 'chapter.published',       // 用户确认定稿

  // === AI生成事件 ===
  AI_GENERATION_REQUESTED = 'ai.generation.requested',
  AI_GENERATION_STARTED = 'ai.generation.started',
  AI_GENERATION_PROGRESS = 'ai.generation.progress',  // 流式进度
  AI_GENERATION_COMPLETED = 'ai.generation.completed',
  AI_GENERATION_FAILED = 'ai.generation.failed',

  // === 记忆系统事件 ===
  MEMORY_EXTRACTION_NEEDED = 'memory.extraction.needed',
  MEMORY_EXTRACTION_STARTED = 'memory.extraction.started',
  MEMORY_EXTRACTION_COMPLETED = 'memory.extraction.completed',
  MEMORY_CONFLICT_DETECTED = 'memory.conflict.detected',  // 设定冲突
  FORESHADOW_RESOLVED = 'foreshadow.resolved',
  FORESHADOW_NEW = 'foreshadow.new',

  // === 同步事件 ===
  SYNC_STARTED = 'sync.started',
  SYNC_COMPLETED = 'sync.completed',
  SYNC_CONFLICT_DETECTED = 'sync.conflict.detected',
  SYNC_CONFLICT_RESOLVED = 'sync.conflict.resolved',

  // === 订阅/账单事件 ===
  SUBSCRIPTION_UPGRADED = 'subscription.upgraded',
  SUBSCRIPTION_DOWNGRADED = 'subscription.downgraded',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  TOKEN_PURCHASED = 'token.purchased',
  TOKEN_CONSUMED = 'token.consumed',
  TOKEN_QUOTA_WARNING = 'token.quota.warning',    // 额度即将用尽
  TOKEN_QUOTA_EXHAUSTED = 'token.quota.exhausted',

  // === 用户事件 ===
  USER_REGISTERED = 'user.registered',
  USER_DELETED = 'user.deleted',
  USER_LOGIN = 'user.login',
}

// 事件载荷
interface ChapterPublishedEvent {
  type: EventType.CHAPTER_PUBLISHED;
  payload: {
    bookId: string;
    chapterId: string;
    userId: string;
    wordCount: number;
    timestamp: string;
  };
}

interface MemoryConflictDetectedEvent {
  type: EventType.MEMORY_CONFLICT_DETECTED;
  payload: {
    bookId: string;
    conflictType: 'foreshadow' | 'character_state' | 'setting' | 'timeline';
    description: string;
    relatedEntities: Array<{ type: string; id: string; name: string }>;
    severity: 'low' | 'medium' | 'high';
    suggestedResolution?: string;
    timestamp: string;
  };
}

interface GenerationCompletedEvent {
  type: EventType.AI_GENERATION_COMPLETED;
  payload: {
    userId: string;
    bookId: string;
    chapterId: string;
    modelUsed: string;
    tokensConsumed: number;
    generationDurationMs: number;
    wordCount: number;
    aiScore?: number;         // AI味指数
    timestamp: string;
  };
}
```

#### 15.1.3 事件处理流程示例：章节发布完整事件链

```
用户点击"确认定稿"
        │
        ▼
┌──────────────────┐
│ 1. CHAPTER_PUBLISHED 事件发布  │
└──────┬───────────┘
       │
       ├──────────────────────────────────────────────────┐
       │                                                  │
       ▼                                                  ▼
┌──────────────────────┐                    ┌──────────────────────┐
│ 记忆系统 (消费者)      │                    │ 通知服务 (消费者)      │
│                      │                    │                      │
│ 触发异步任务:         │                    │ 触发:                 │
│ · 事件提取           │                    │ · 字数统计更新         │
│ · 角色状态更新        │                    │ · Token消耗记录        │
│ · 伏笔扫描           │                    │ · 创作日历更新         │
│ · 风格锚点更新        │                    │ · 里程碑检查           │
│ · 向量嵌入重算        │                    │   (第10章/第100章等)  │
│ · 冲突检测扫描        │                    └──────────────────────┘
└──────────────────────┘
       │
       ▼
┌──────────────────────┐
│ 检查: 是否有新冲突?    │
│ 是 → MEMORY_CONFLICT_DETECTED │
│ 否 → 静默完成                │
└──────────────────────┘
```

### 15.2 错误处理策略

#### 15.2.1 错误分层

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: AI Provider Errors                             │
│ · API超时 (>60s)           → 自动重试(最多3次) + 指数退避  │
│ · Rate Limit (429)         → 等待 + 降级到备用模型          │
│ · 模型不可用 (503)          → 故障切换到fallback模型          │
│ · 内容过滤 (content_filter) → 返回给用户 + 建议调整Prompt     │
│ · Token超限 (context_length)→ 压缩上下文 + 重试              │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ Layer 2: AI Orchestrator Errors                         │
│ · Prompt组装失败          → 返回明确错误 + 重试提示           │
│ · 记忆检索超时            → 降级为仅使用短期记忆 + 警告用户     │
│ · 流式连接中断            → 自动重连 + 断点续传 + 进度保留       │
│ · Agent执行失败           → 降级策略(跳过此Agent) + 日志记录   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ Layer 3: API Gateway / Service Errors                   │
│ · 认证失败 (401)          → 刷新Token或跳转登录              │
│ · 权限不足 (403)          → 显示套餐升级提示                  │
│ · 资源不存在 (404)        → 提示用户 + 返回列表页              │
│ · 并发冲突 (409)          → 展示冲突解决UI                   │
│ · 服务内部错误 (500)      → 通用错误提示 + 自动重试 + 日志上报  │
│ · 服务不可用 (503)        → 维护模式提示 + 定时重连             │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ Layer 4: Client Errors                                 │
│ · 网络断开                → 自动切换到离线模式 (Lite+)        │
│ · 本地存储空间不足         → 提示清理 + 建议卸载不常用书籍       │
│ · 客户端崩溃              → 自动保存恢复 + 崩溃报告            │
│ · 同步冲突                → 弹出冲突解决UI (见14.3.2)         │
└─────────────────────────────────────────────────────────┘
```

#### 15.2.2 标准化错误响应格式

```typescript
// shared/types/error.types.ts

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;                    // 机器可读错误码
    message: string;                 // 用户可读错误消息（中文）
    detail?: string;                 // 详细技术描述（仅开发模式）
    requestId: string;               // 用于追踪和日志关联
    timestamp: string;
    retryable: boolean;             // 是否可重试
    retryAfter?: number;            // 建议重试等待秒数
    actions?: ErrorAction[];        // 推荐用户操作
  };
}

interface ErrorAction {
  label: string;                    // 按钮文案，如 "升级套餐"
  type: 'upgrade' | 'retry' | 'settings' | 'help' | 'dismiss';
  route?: string;                   // 跳转路径
  params?: Record<string, string>;  // 路由参数
}

// 错误码枚举 (部分)
enum ErrorCode {
  // 认证类 (AUTH_*)
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_LOGIN_REQUIRED = 'AUTH_LOGIN_REQUIRED',
  AUTH_RATE_LIMITED = 'AUTH_RATE_LIMITED',

  // 权限类 (PERM_*)
  PERM_INSUFFICIENT_TIER = 'PERM_INSUFFICIENT_TIER',
  PERM_TOKEN_QUOTA_EXHAUSTED = 'PERM_TOKEN_QUOTA_EXHAUSTED',
  PERM_WORD_LIMIT_REACHED = 'PERM_WORD_LIMIT_REACHED',
  PERM_WORKSPACE_FULL = 'PERM_WORKSPACE_FULL',
  PERM_FEATURE_LOCKED = 'PERM_FEATURE_LOCKED',

  // 资源类 (RES_*)
  RES_NOT_FOUND = 'RES_NOT_FOUND',
  RES_ALREADY_EXISTS = 'RES_ALREADY_EXISTS',
  RES_CONFLICT = 'RES_CONFLICT',
  RES_DELETED = 'RES_DELETED',

  // AI类 (AI_*)
  AI_GENERATION_FAILED = 'AI_GENERATION_FAILED',
  AI_MODEL_UNAVAILABLE = 'AI_MODEL_UNAVAILABLE',
  AI_CONTEXT_TOO_LARGE = 'AI_CONTEXT_TOO_LARGE',
  AI_CONTENT_FILTERED = 'AI_CONTENT_FILTERED',
  AI_TIMEOUT = 'AI_TIMEOUT',
  AI_RATE_LIMITED = 'AI_RATE_LIMITED',

  // 同步类 (SYNC_*)
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  SYNC_FAILED = 'SYNC_FAILED',
  SYNC_VERSION_MISMATCH = 'SYNC_VERSION_MISMATCH',

  // 系统类 (SYS_*)
  SYS_INTERNAL_ERROR = 'SYS_INTERNAL_ERROR',
  SYS_MAINTENANCE = 'SYS_MAINTENANCE',
  SYS_DATABASE_ERROR = 'SYS_DATABASE_ERROR',
}
```

### 15.3 缓存策略

#### 15.3.1 多层缓存架构

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: 客户端内存缓存 (React State / Zustand)               │
│ · 当前编辑章节全文                                           │
│ · 当前卷的章纲列表                                           │
│ · 已展开的大纲树节点                                         │
│ · 用户偏好设置                                              │
│ TTL: 会话期间 | 失效策略: 用户操作触发                        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Layer 2: 客户端本地缓存 (SQLite — Lite+套餐)                  │
│ · 用户选择下载的书籍完整数据                                   │
│ · 最近编辑的章节全文 (离线可用)                                │
│ · 操作日志 (待同步队列)                                      │
│ TTL: 手动管理 | 失效策略: 同步后更新                           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Layer 3: 服务端 Redis 缓存                                   │
│ · 用户会话 (JWT + 套餐信息) — TTL: 15分钟 (与access token一致) │
│ · 套餐额度计数 — TTL: 当月                                     │
│ · 大纲/章纲数据 — TTL: 30分钟, LRU淘汰                       │
│ · 角色信息摘要 — TTL: 1小时                                   │
│ · 记忆检索热门结果 — TTL: 10分钟                              │
│ · API限流计数器 — TTL: 按窗口期                               │
│ · 热门章节内容 — TTL: 1小时, LRU淘汰                         │
│ · 模板/Prompt缓存 — TTL: 永久, 版本更新时失效                  │
│ 失效策略: TTL自动过期 + 写操作主动失效 (Cache-Aside模式)      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Layer 4: CDN缓存 (静态资源)                                  │
│ · 导出文件 — TTL: 24小时                                     │
│ · 用户头像 — TTL: 1小时                                      │
│ · 静态资源 (JS/CSS/图标) — TTL: 版本化永久缓存                 │
│ 失效策略: 文件名版本化 (hash)                                  │
└─────────────────────────────────────────────────────────────┘
```

#### 15.3.2 Cache-Aside 模式实现

```typescript
// server/src/common/cache/cache-aside.service.ts

@Injectable()
export class CacheAsideService {
  constructor(
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Cache-Aside 读取模式
   * 1. 先查缓存
   * 2. 缓存未命中 → 查数据库 → 写入缓存 → 返回
   * 3. 缓存命中 → 直接返回
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    dbLoader: () => Promise<T | null>,
    options?: { forceRefresh?: boolean; skipCache?: boolean },
  ): Promise<T | null> {
    if (options?.skipCache) {
      return dbLoader();
    }

    if (!options?.forceRefresh) {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        this.logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(cached) as T;
      }
    }

    this.logger.debug(`Cache MISS: ${key}`);
    const data = await dbLoader();

    if (data !== null) {
      await this.redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    }

    return data;
  }

  /**
   * 写操作后主动失效相关缓存
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.debug(`Cache invalidated: ${pattern} (${keys.length} keys)`);
    }
  }
}
```

### 15.4 API限流与节流策略

| 套餐 | 每分钟请求数 (RPM) | 每日请求数 (RPD) | 并发连接数 | 突发倍数 |
|------|-------------------|-----------------|-----------|---------|
| Free | 30 | 500 | 2 | 1x |
| Lite | 60 | 2000 | 5 | 1.5x |
| Basic | 120 | 5000 | 10 | 2x |
| Plus | 300 | 10000 | 20 | 2x |
| Pro | 600 | 20000 | 50 | 3x |

```typescript
// 限流实现 (基于 Redis 滑动窗口)
// server/src/common/throttle/throttle.service.ts

@Injectable()
export class ThrottleService {
  /**
   * 滑动窗口限流
   */
  async checkRateLimit(
    userId: string,
    tier: SubscriptionTier,
    limitType: 'rpm' | 'rpd' | 'concurrent',
  ): Promise<RateLimitResult> {
    const config = RATE_LIMIT_CONFIGS[tier];
    const key = `rate:${limitType}:${userId}`;
    const now = Date.now();
    const windowMs = limitType === 'rpm' ? 60_000 : 86_400_000;

    // 使用 Redis Sorted Set 实现滑动窗口
    const windowStart = now - windowMs;

    await this.redis.zremrangebyscore(key, 0, windowStart); // 清理过期记录
    const currentCount = await this.redis.zcard(key);

    const limit = limitType === 'rpm' ? config.rpm : config.rpd;

    if (currentCount >= limit) {
      const oldestInWindow = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = oldestInWindow.length > 0
        ? parseInt(oldestInWindow[1]) + windowMs
        : now + windowMs;

      return {
        allowed: false,
        currentCount,
        limit,
        resetAt: new Date(resetTime).toISOString(),
        retryAfterMs: resetTime - now,
      };
    }

    // 记录本次请求
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, Math.ceil(windowMs / 1000) + 60);

    return { allowed: true, currentCount: currentCount + 1, limit };
  }
}
```

### 15.5 目录结构补充

在现有 `server/src/modules/` 下增加：

```
server/src/modules/
├── ... (现有模块)
├── event-bus/                       # 新增：事件总线模块
│   ├── event-bus.module.ts
│   ├── event-bus.service.ts          # 事件发布/订阅核心
│   ├── event.types.ts               # 事件类型定义
│   └── handlers/                     # 事件处理器
│       ├── chapter-published.handler.ts
│       ├── generation-completed.handler.ts
│       └── memory-conflict.handler.ts
├── rate-limit/                       # 新增：限流模块
│   ├── rate-limit.module.ts
│   ├── rate-limit.guard.ts
│   ├── rate-limit.service.ts
│   └── rate-limit.decorator.ts
├── cache/                            # 新增：缓存模块
│   ├── cache.module.ts
│   ├── cache-aside.service.ts
│   ├── cache-warmup.service.ts       # 缓存预热
│   └── cache-invalidation.service.ts
├── audit/                            # 新增：审计日志模块
│   ├── audit.module.ts
│   ├── audit.service.ts
│   ├── audit.entity.ts
│   └── audit.interceptor.ts          # 自动记录关键操作
├── health/                           # 新增：健康检查模块
│   ├── health.module.ts
│   ├── health.controller.ts          # /health, /health/ready
│   └── health-indicators/
│       ├── database.indicator.ts
│       ├── redis.indicator.ts
│       └── ai-provider.indicator.ts
└── analytics/                        # 新增：数据分析模块
    ├── analytics.module.ts
    ├── analytics.service.ts          # 用户行为分析
    └── metrics.service.ts            # 业务指标收集
```

---

## 16. 前端开发补充

### 16.1 核心组件 Props/State 接口设计

#### 16.1.1 OutlineTree 组件

```typescript
// client/src/components/outline/OutlineTree.tsx

interface OutlineTreeNode {
  id: string;
  type: 'book' | 'volume' | 'chapter';
  title: string;
  sortOrder: number;
  status: 'draft' | 'in_progress' | 'completed' | 'planned';
  wordCount?: number;
  children?: OutlineTreeNode[];
  metadata?: {
    chapterOutline?: string;         // 章纲内容
    instruction?: string;            // 写作指令
    summary?: string;               // 章节摘要
    aiGenerated: boolean;
    lastGeneratedAt?: string;
  };
}

interface OutlineTreeProps {
  /** 整棵纲树的根节点 */
  tree: OutlineTreeNode[];
  /** 当前活跃节点的ID */
  activeNodeId: string | null;
  /** 展开的节点ID集合 */
  expandedIds: Set<string>;
  /** 是否显示字数统计 */
  showWordCount?: boolean;
  /** 是否显示状态图标 */
  showStatus?: boolean;
  /** 用户套餐等级（影响可用操作） */
  userTier: SubscriptionTier;

  // 回调
  onNodeSelect: (nodeId: string, nodeType: 'book' | 'volume' | 'chapter') => void;
  onNodeExpand: (nodeId: string) => void;
  onNodeCollapse: (nodeId: string) => void;
  onNodeCreate: (parentId: string, type: 'volume' | 'chapter') => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeRename: (nodeId: string, newTitle: string) => void;
  onNodeDragEnd: (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  onGenerateOutline: (nodeId: string) => void;     // AI生成章纲
  onGenerateContent: (nodeId: string) => void;     // AI生成正文
  onBatchGenerate: (nodeIds: string[]) => void;    // 批量生成
}

interface OutlineTreeState {
  /** 搜索过滤文本 */
  filterText: string;
  /** 按状态过滤 */
  statusFilter: OutlineTreeNode['status'] | 'all';
  /** 拖拽中的节点 */
  draggingNodeId: string | null;
  /** 右键菜单目标节点 */
  contextMenuNode: OutlineTreeNode | null;
  /** 右键菜单位置 */
  contextMenuPosition: { x: number; y: number };
  /** 内联编辑中的节点 */
  editingNodeId: string | null;
}
```

#### 16.1.2 StreamingText 组件

```typescript
// client/src/components/ai/StreamingText.tsx

interface StreamingTextProps {
  /** 生成模式：append=追加到现有内容, replace=替换, insert=在光标处插入 */
  mode: 'append' | 'replace' | 'insert';
  /** 目标编辑器实例 */
  editor: Editor | null;
  /** SSE事件源URL */
  endpoint: string;
  /** 请求体 */
  requestBody: Record<string, unknown>;
  /** 打字机速度：每字符延迟(ms)，0=最快 */
  typewriterDelay?: number;
  /** 是否自动滚动到最新内容 */
  autoScroll?: boolean;

  // 生命周期回调
  onStreamStart?: () => void;
  onStreamToken?: (token: string, fullText: string) => void;
  onStreamComplete?: (fullText: string, metadata: GenerationMetadata) => void;
  onStreamError?: (error: StreamingError) => void;
  onStreamAbort?: () => void;
}

interface GenerationMetadata {
  modelUsed: string;
  tokensConsumed: number;
  generationDurationMs: number;
  promptTokens: number;
  completionTokens: number;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
}

interface StreamingError {
  code: string;
  message: string;
  retryable: boolean;
  partialText?: string;              // 出错前已生成的部分文本
}
```

#### 16.1.3 CharacterProfile 组件

```typescript
// client/src/components/characters/CharacterProfile.tsx

interface CharacterProfileProps {
  character: Character;
  /** 编辑模式 */
  mode: 'view' | 'edit' | 'create';
  /** 是否在右侧面板中显示（影响布局） */
  inPanel?: boolean;

  // 回调
  onSave: (data: CharacterFormData) => Promise<void>;
  onDelete?: (characterId: string) => Promise<void>;
  onCancel?: () => void;
  onRequestAIGenerate?: (field: keyof CharacterFormData) => void;
}

interface CharacterFormData {
  name: string;
  alias: string[];
  category: 'protagonist' | 'supporting' | 'antagonist' | 'cameo';
  gender: 'male' | 'female' | 'other';
  age: string;                        // "外表25岁，实际300岁"
  appearance: string;
  personality: string;
  background: string;
  abilities: Skill[];
  goals: string;
  arcSummary: string;
  relationships: CharacterRelation[];
  avatar?: File | string;             // 头像
  tags: string[];                     // 标签：如"腹黑"、"剑修"、"隐藏大佬"
}

interface Skill {
  name: string;
  level: string;                      // "入门/小成/大成/圆满"
  description: string;
  acquiredChapter?: string;           // 获得该技能的章节
}

interface CharacterRelation {
  targetCharacterId: string;
  targetCharacterName: string;
  relationType: 'family' | 'friend' | 'lover' | 'enemy' | 'master_student' | 'rival' | 'other';
  description: string;
  intensity: number;                  // 1-10 关系强度
  sinceChapter?: string;              // 关系建立的章节
}
```

### 16.2 组件通信模式

```
┌─────────────────────────────────────────────────────────────────┐
│                      组件通信架构                                  │
│                                                                 │
│  Layer 1: Zustand 全局 Store (跨组件共享状态)                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ authStore │ projectStore │ editorStore │ aiStore          │ │
│  │ outlineStore │ characterStore │ syncStore │ uiStore       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Layer 2: React Context (局部共享，避免prop drilling)             │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ BookContext │ EditorContext │ GenerationContext            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Layer 3: IPC (渲染进程 ↔ 主进程)                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ contextBridge.exposeInMainWorld('electronAPI', { ... })    │ │
│  │ · electronAPI.saveFile(path, content)                      │ │
│  │ · electronAPI.readFile(path)                                │ │
│  │ · electronAPI.syncWithCloud(bookId)                        │ │
│  │ · electronAPI.getAppVersion()                              │ │
│  │ · electronAPI.onSyncStatusChange(callback)                 │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Layer 4: WebSocket (实时双向通信)                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ · 云端同步状态推送                                          │ │
│  │ · 冲突通知                                                 │ │
│  │ · AI生成进度推送（补充SSE）                                  │ │
│  │ · 系统通知                                                 │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 16.3 性能优化策略

#### 16.3.1 大文本渲染优化

```typescript
// 对于超长章节 (>5万字)，使用 Tiptap 的虚拟滚动或分页模式

// 策略1: Tiptap + 分页渲染
// 只渲染当前视口附近的段落，远离视口的段落使用占位符

// 策略2: 章节分块加载
// 编辑500万字小说时，按卷/章懒加载，不一次性加载全部数据到编辑器

// client/src/hooks/useChapterLoader.ts
function useChapterLoader(bookId: string, chapterId: string) {
  const [content, setContent] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  // 预加载策略：后台预加载相邻章节
  useEffect(() => {
    const adjacentIds = getAdjacentChapterIds(bookId, chapterId);
    // 使用 requestIdleCallback 或低优先级加载
    adjacentIds.forEach(id => {
      scheduleLowPriorityLoad(id);
    });
  }, [bookId, chapterId]);

  return { content, loadingState };
}
```

#### 16.3.2 代码分割与懒加载

```typescript
// client/src/App.tsx — 路由级代码分割

import { lazy, Suspense } from 'react';

const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const CharacterGraphPage = lazy(() => import('./pages/CharacterGraphPage'));
const ExportPage = lazy(() => import('./pages/ExportPage'));

// 重型组件懒加载
const RelationshipGraph = lazy(() => import('./components/characters/RelationshipGraph'));
const MarkdownPreview = lazy(() => import('./components/editor/MarkdownPreview'));
const AnalyticsDashboard = lazy(() => import('./components/subscription/AnalyticsDashboard'));
```

### 16.4 状态管理架构

```typescript
// client/src/stores/editor.store.ts — 示例：编辑器Store设计

interface EditorState {
  // === 当前编辑上下文 ===
  currentBookId: string | null;
  currentVolumeId: string | null;
  currentChapterId: string | null;

  // === 编辑器状态 ===
  isDirty: boolean;                    // 是否有未保存修改
  lastSavedAt: string | null;         // 上次保存时间
  wordCount: number;

  // === AI生成状态 ===
  isGenerating: boolean;
  generationProgress: {
    totalTokens: number;
    generatedTokens: number;
    estimatedTotalWords: number;
    currentWords: number;
    startTime: string;
  } | null;
  generationError: StreamingError | null;

  // === 同步状态 ===
  syncStatus: 'synced' | 'syncing' | 'pending' | 'error' | 'offline';
  lastSyncedAt: string | null;

  // === 视图状态 ===
  showRightPanel: boolean;
  rightPanelTab: 'outline' | 'instruction' | 'review' | 'memory' | 'settings';
  showChatPanel: boolean;
  editorZoom: number;                  // 0.75 — 1.5

  // === AI去味审查状态 ===
  reviewResults: DehumanizeReviewResult | null;
  showReviewDiff: boolean;

  // === Actions ===
  setCurrentChapter: (bookId: string, volumeId: string, chapterId: string) => void;
  setDirty: (dirty: boolean) => void;
  updateWordCount: (count: number) => void;
  startGeneration: () => void;
  updateGenerationProgress: (progress: Partial<GenerationProgress>) => void;
  completeGeneration: (metadata: GenerationMetadata) => void;
  failGeneration: (error: StreamingError) => void;
  abortGeneration: () => void;
  setSyncStatus: (status: SyncStatus) => void;
  toggleRightPanel: () => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setReviewResults: (results: DehumanizeReviewResult | null) => void;

  // === 中间件 ===
  // persist: 自动保存编辑器状态到 localStorage
  // devtools: 开发环境 Redux DevTools 支持
}
```

### 16.5 主题系统设计

```css
/* client/src/styles/themes.css */

:root {
  /* === 基础色板 === */
  --color-white: #ffffff;
  --color-black: #000000;

  /* === 语义色 (跨主题共享) === */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
}

/* === 浅色主题 === */
[data-theme="light"] {
  /* 背景层级 */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --bg-elevated: #ffffff;
  --bg-hover: #e2e8f0;
  --bg-active: #cbd5e1;

  /* 文字层级 */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #94a3b8;
  --text-inverse: #ffffff;

  /* 边框 */
  --border-primary: #e2e8f0;
  --border-secondary: #cbd5e1;

  /* 编辑器区域 */
  --editor-bg: #ffffff;
  --editor-text: #1e293b;
  --editor-cursor: #0f172a;
  --editor-selection: #bae6fd;
  --editor-line-number: #94a3b8;

  /* AI生成文本 */
  --ai-generated-bg: #f0f9ff;
  --ai-generated-border: #bae6fd;

  /* 品牌色 */
  --brand-primary: #6366f1;
  --brand-primary-hover: #4f46e5;
  --brand-primary-text: #ffffff;
}

/* === 深色主题 === */
[data-theme="dark"] {
  /* 背景层级 */
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  --bg-elevated: #1e293b;
  --bg-hover: #334155;
  --bg-active: #475569;

  /* 文字层级 */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  --text-inverse: #0f172a;

  /* 边框 */
  --border-primary: #334155;
  --border-secondary: #475569;

  /* 编辑器区域 */
  --editor-bg: #1e293b;
  --editor-text: #e2e8f0;
  --editor-cursor: #f1f5f9;
  --editor-selection: #1e3a5f;
  --editor-line-number: #64748b;

  /* AI生成文本 */
  --ai-generated-bg: #0c1929;
  --ai-generated-border: #1e3a5f;

  /* 品牌色 (深色模式下微调) */
  --brand-primary: #818cf8;
  --brand-primary-hover: #6366f1;
  --brand-primary-text: #0f172a;
}
```

```typescript
// client/src/hooks/useTheme.ts
type Theme = 'light' | 'dark' | 'system';

function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'system';
  });

  const resolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    localStorage.setItem('theme', theme);
  }, [resolvedTheme, theme]);

  return { theme, resolvedTheme, setTheme: setThemeState };
}
```

### 16.6 错误边界与加载状态

```typescript
// client/src/components/common/ErrorBoundary.tsx

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** 错误发生的模块名称，用于日志和展示 */
  module?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// 使用示例:
// <ErrorBoundary module="大纲树" onError={logToService}>
//   <OutlineTree ... />
// </ErrorBoundary>

// 错误回退UI:
function DefaultErrorFallback({ error, module, onRetry }: {
  error: Error;
  module?: string;
  onRetry: () => void;
}) {
  return (
    <div className="error-fallback">
      <div className="error-fallback-icon">⚠</div>
      <h3>{module ? `${module}加载失败` : '组件加载失败'}</h3>
      <p className="error-fallback-message">{error.message}</p>
      <div className="error-fallback-actions">
        <button onClick={onRetry}>重试</button>
        <button onClick={() => window.location.reload()}>刷新页面</button>
        <button onClick={() => {/* 打开帮助 */}}>获取帮助</button>
      </div>
    </div>
  );
}
```

```typescript
// 统一加载状态组件
// client/src/components/common/LoadingStates.tsx

// 骨架屏 — 编辑器加载中
function EditorSkeleton() {
  return (
    <div className="skeleton-editor animate-pulse">
      <div className="skeleton-line w-3/4 h-4 bg-gray-200 rounded mb-3" />
      <div className="skeleton-line w-full h-4 bg-gray-200 rounded mb-3" />
      <div className="skeleton-line w-5/6 h-4 bg-gray-200 rounded mb-3" />
      <div className="skeleton-line w-2/3 h-4 bg-gray-200 rounded mb-3" />
      <div className="skeleton-line w-full h-4 bg-gray-200 rounded mb-10" />
      <div className="skeleton-line w-4/5 h-4 bg-gray-200 rounded mb-3" />
      <div className="skeleton-line w-3/4 h-4 bg-gray-200 rounded mb-3" />
    </div>
  );
}

// 渐进式加载指示器 — AI生成中
function GenerationLoadingIndicator({ progress }: { progress: GenerationProgress }) {
  const elapsed = Date.now() - new Date(progress.startTime).getTime();
  const speed = progress.currentWords / (elapsed / 1000); // 字/秒

  return (
    <div className="generation-indicator">
      <div className="flex items-center gap-2">
        <Spinner />
        <span>AI正在生成... {progress.currentWords}字</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${(progress.generatedTokens / progress.totalTokens) * 100}%` }}
        />
      </div>
      <div className="text-xs text-gray-500">
        速度: {speed.toFixed(1)} 字/秒 | 预计剩余: {((progress.estimatedTotalWords - progress.currentWords) / speed / 60).toFixed(1)} 分钟
      </div>
    </div>
  );
}
```

---

## 17. 后端开发补充

### 17.1 关键API详细设计

#### 17.1.1 AI生成章节正文

```
POST /api/v1/ai/generate-content

Request:
{
  "bookId": "uuid",
  "volumeId": "uuid",
  "chapterId": "uuid",              // 可选，新建章节时不传
  "chapterOutline": "string",       // 章纲内容
  "instruction": "string",          // 用户自定义写作指令
  "options": {
    "targetWordCount": 3000,        // 目标字数
    "styleProfileId": "uuid",       // 文风配置ID
    "temperature": 0.7,             // 创造性 (0.1-1.5)
    "presencePenalty": 0.6,         // 话题重复惩罚
    "frequencyPenalty": 0.3,        // 词汇重复惩罚
    "maxTokens": 6000,              // 最大生成Token数
    "stopSequences": ["---", "###"], // 停止序列
    "autoReview": true,             // 生成后是否自动质检 (默认true)
    "autoDehumanize": false         // 生成后是否自动去味审查
  },
  "contextHints": {                 // 可选：用户手动指定的上下文提示
    "charactersToInclude": ["uuid"],
    "foreshadowsToAddress": ["uuid"],
    "eventsToReference": ["uuid"],
    "styleNotes": "string"
  }
}

Response (SSE Stream):
event: start
data: {"requestId":"uuid","estimatedTokens":4500}

event: token
data: {"text":"陈凡","index":0}

event: token
data: {"text":"踏入","index":1}

... (逐token流式输出)

event: progress
data: {"tokensGenerated":1500,"estimatedProgress":0.33}

event: complete
data: {
  "requestId": "uuid",
  "fullText": "陈凡踏入天道殿...",
  "metadata": {
    "modelUsed": "deepseek-v4-pro",
    "modelTier": "pro",
    "promptTokens": 2500,
    "completionTokens": 4500,
    "totalTokens": 7000,
    "generationDurationMs": 18500,
    "wordCount": 3120,
    "finishReason": "stop"
  },
  "usage": {
    "tokensConsumedThisRequest": 7000,
    "quotaTokensRemaining": 150000,
    "purchasedTokensRemaining": 300000,
    "totalWordsGeneratedThisMonth": 45000
  },
  "reviewTaskId": "uuid"            // 用于查询异步质检结果
}

event: error
data: {
  "code": "AI_CONTEXT_TOO_LARGE",
  "message": "上下文超出模型限制，已自动压缩。请尝试缩短章纲或减少记忆上下文。",
  "retryable": true,
  "retryAfter": 5
}
```

#### 17.1.2 语义记忆检索

```
POST /api/v1/books/:bookId/memory/search

Request:
{
  "query": "陈凡与白泽的决战场面",   // 自然语言查询
  "queryEmbedding"?: number[],      // 可选：客户端预计算的embedding
  "filters": {
    "memoryTypes": ["event", "foreshadow", "character_state", "setting_patch"],
    "characterIds": ["uuid"],       // 限定关联角色
    "timeRange": {
      "from": "chapter-100",
      "to": "chapter-450"
    },
    "importanceMin": 5,             // 最低重要性
    "eventTypes": ["battle", "breakthrough", "betrayal"]
  },
  "limit": 20,
  "minScore": 0.5,                  // 最低相似度
  "includeVectors": false           // 是否返回向量（调试用）
}

Response:
{
  "results": [
    {
      "id": "uuid",
      "type": "event",
      "title": "陈凡与白泽在苍梧山的初次对决",
      "summary": "陈凡以大罗金仙初期修为迎战白泽的上古神兽本体...",
      "score": 0.92,
      "scores": {
        "vectorSimilarity": 0.89,
        "textRelevance": 0.85,
        "timeDecayFactor": 0.78,
        "importanceBoost": 1.2,
        "finalScore": 0.92
      },
      "metadata": {
        "chapterNumber": 287,
        "chapterTitle": "苍梧山之战",
        "characters": ["陈凡", "白泽", "青鸾"],
        "importance": 9,
        "createdAt": "2026-03-15T10:30:00Z"
      },
      "relatedResults": [
        { "id": "uuid", "type": "character_state", "title": "陈凡战后的修为突破" },
        { "id": "uuid", "type": "foreshadow", "title": "伏笔#12: 天道碎片的下落" }
      ]
    }
    // ... 更多结果
  ],
  "totalFound": 47,
  "searchDurationMs": 85,
  "embeddingModel": "text-embedding-3-small"
}
```

#### 17.1.3 AI去味审查

```
POST /api/v1/ai/review/dehumanize

Request:
{
  "chapterId": "uuid",
  "content": "string",             // 要审查的文本
  "intensity": 5,                  // 去味强度 1-10
  "focusAreas": [                  // 关注的维度（不传=全部）
    "sentence_variety",
    "transition_density",
    "emotion_depth",
    "dialogue_diversity",
    "over_explanation"
  ],
  "referenceStyle": {             // 可选：参考文风
    "styleProfileId": "uuid"
  }
}

Response:
{
  "reviewId": "uuid",
  "aiScore": {
    "overall": 72,                  // 综合AI味指数 0-100
    "dimensions": {
      "sentenceVariety": 68,        // 句式重复度 (越低越AI)
      "transitionDensity": 75,      // 过渡词密度
      "emotionDepth": 80,           // 情感平铺度 (越高越平)
      "dialogueDiversity": 55,      // 对话差异性 (越低越千人一面)
      "overExplanation": 85,        // 过度解释 (越高越AI)
      "rhythmUniformity": 70,       // 节奏单一性
      "rhetoricNaturalness": 65     // 修辞自然度
    }
  },
  "suggestions": [
    {
      "id": "sug-001",
      "type": "sentence_variety",
      "severity": "high",
      "originalText": "他不仅感觉到愤怒，而且还有一种深深的无力感。",
      "suggestedText": "他心中涌起一股怒意，拳头不由自主地攥紧。可是——他又能做什么呢？那股无力感像潮水一样漫上来。",
      "reason": "'不仅...而且...' 是AI高频句式，建议拆分为短句+设问+比喻",
      "position": { "start": 245, "end": 278 }
    }
    // ... 更多建议
  ],
  "statistics": {
    "totalSuggestions": 15,
    "byType": {
      "sentence_variety": 5,
      "transition_density": 3,
      "emotion_depth": 2,
      "dialogue_diversity": 1,
      "over_explanation": 3,
      "rhythm_uniformity": 1
    },
    "bySeverity": {
      "high": 4,
      "medium": 7,
      "low": 4
    }
  },
  "processingCost": {
    "scanTokens": 1500,
    "rewriteTokens": 8000,
    "totalTokens": 9500
  }
}
```

### 17.2 数据库索引策略补充

```sql
-- === 补充索引（在原有基础上新增） ===

-- 1. 书籍列表按用户+更新时间排序（写作台高频查询）
CREATE INDEX idx_books_user_updated ON books(user_id, updated_at DESC);

-- 2. 章节按卷+章节号排序（纲树展示）
CREATE INDEX idx_chapters_volume_order ON chapters(volume_id, chapter_number);

-- 3. 版本历史按创建时间倒序（取最新版本）
CREATE INDEX idx_versions_chapter_created ON chapter_versions(chapter_id, created_at DESC);

-- 4. 记忆检索 — 按书籍+重要性过滤
CREATE INDEX idx_events_book_importance ON events(book_id, importance DESC);

-- 5. 记忆检索 — 事件类型过滤
CREATE INDEX idx_events_book_type ON events(book_id, event_type);

-- 6. 角色状态按角色+章节时间戳排序
CREATE INDEX idx_character_states_char_time ON character_states(character_id, chapter_timestamp DESC);

-- 7. 伏笔按状态过滤
CREATE INDEX idx_foreshadows_book_status ON foreshadows(book_id, status);

-- 8. Token交易按用户+时间（消费记录查询）
CREATE INDEX idx_token_tx_user_time ON token_transactions(user_id, created_at DESC);

-- 9. 月度用量 — 覆盖索引（避免回表）
CREATE INDEX idx_monthly_usage_user_month ON monthly_usage(user_id, year_month);

-- 10. 支付记录按用户+时间
CREATE INDEX idx_payments_user_time ON payments(user_id, created_at DESC);

-- 11. 同步版本冲突检测 — 按书籍ID+版本号
CREATE INDEX idx_books_sync_version ON books(id, sync_version);

-- 12. 部分索引 — 仅活跃订阅用户
CREATE INDEX idx_subscriptions_active ON subscriptions(user_id, tier)
  WHERE status = 'active';

-- 13. 全文搜索 — 复合索引优化多字段搜索
-- (依赖已有的 GIN 索引 idx_chapters_search)
-- 查询示例: 跨书籍全局搜索
CREATE INDEX idx_chapters_book_search ON chapters(volume_id)
  INCLUDE (title, word_count, status);
```

### 17.3 后台任务系统 (BullMQ) 详细设计

```typescript
// server/src/modules/queue/queue.types.ts

enum QueueName {
  MEMORY_EXTRACTION = 'memory-extraction',       // 记忆提取
  QUALITY_INSPECTION = 'quality-inspection',     // 质检审查
  DEHUMANIZE_REVIEW = 'dehumanize-review',       // AI去味审查
  EXPORT_GENERATION = 'export-generation',       // 导出文件生成
  NOTIFICATION = 'notification',                 // 通知发送
  SYNC_PROCESSING = 'sync-processing',           // 同步处理
  ANALYTICS = 'analytics',                       // 数据统计
  CLEANUP = 'cleanup',                           // 定时清理
}

// 任务定义
interface MemoryExtractionJob {
  queue: QueueName.MEMORY_EXTRACTION;
  data: {
    bookId: string;
    chapterId: string;
    chapterContent: string;
    chapterNumber: number;
    extractionTypes: ExtractionType[];
  };
  opts: {
    priority: number;                  // 1(highest)-10(lowest)
    attempts: 3;                       // 最大重试次数
    backoff: {
      type: 'exponential';
      delay: 5000;                     // 初始延迟5秒
    };
    removeOnComplete: 100;            // 保留最近100条完成记录
    removeOnFail: 500;                // 保留最近500条失败记录
  };
}

// === 队列配置 ===
// server/src/config/queue.config.ts

const QUEUE_CONFIGS = {
  [QueueName.MEMORY_EXTRACTION]: {
    concurrency: 4,                    // 并发Worker数
    limiter: {
      max: 20,                         // 每时间窗口最大任务数
      duration: 60000,                 // 时间窗口 (毫秒)
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
      timeout: 5 * 60 * 1000,          // 5分钟超时
    },
  },

  [QueueName.QUALITY_INSPECTION]: {
    concurrency: 3,
    limiter: { max: 10, duration: 60000 },
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed' as const, delay: 10000 },
      timeout: 3 * 60 * 1000,
    },
  },

  [QueueName.DEHUMANIZE_REVIEW]: {
    concurrency: 3,
    limiter: { max: 15, duration: 60000 },
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential' as const, delay: 3000 },
      timeout: 5 * 60 * 1000,
    },
  },

  [QueueName.EXPORT_GENERATION]: {
    concurrency: 2,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'fixed' as const, delay: 30000 },
      timeout: 10 * 60 * 1000,         // 导出任务可能耗时较长
    },
  },
};

// === Worker 实现示例 ===
// server/src/modules/queue/workers/memory-extraction.worker.ts

@Processor(QueueName.MEMORY_EXTRACTION)
export class MemoryExtractionWorker {
  constructor(
    private readonly memoryExtractionService: MemoryExtractionService,
    private readonly eventBus: EventBusService,
    private readonly logger: LoggerService,
  ) {}

  @Process()
  async extractMemory(job: Job<MemoryExtractionJob['data']>): Promise<ExtractionResult> {
    const { bookId, chapterId, chapterContent, chapterNumber } = job.data;
    const startTime = Date.now();

    this.logger.log(`Starting memory extraction for chapter ${chapterNumber}`, {
      bookId, chapterId, jobId: job.id,
    });

    // 更新进度
    let progress = 0;
    await job.updateProgress(progress);

    try {
      // Step 1: 事件摘要提取
      const events = await this.memoryExtractionService.extractEvents(chapterContent, bookId);
      progress += 25;
      await job.updateProgress(progress);

      // Step 2: 角色状态更新
      const characterUpdates = await this.memoryExtractionService.updateCharacterStates(
        chapterContent, bookId, chapterId, chapterNumber
      );
      progress += 25;
      await job.updateProgress(progress);

      // Step 3: 伏笔扫描
      const foreshadowResults = await this.memoryExtractionService.scanForeshadows(
        chapterContent, bookId, chapterId
      );
      progress += 20;
      await job.updateProgress(progress);

      // Step 4: 设定更新检测
      const settingUpdates = await this.memoryExtractionService.detectSettingUpdates(
        chapterContent, bookId, chapterId
      );
      progress += 15;
      await job.updateProgress(progress);

      // Step 5: 生成向量嵌入
      await this.memoryExtractionService.generateEmbeddings(bookId, chapterId);
      progress += 10;
      await job.updateProgress(progress);

      // Step 6: 冲突检测
      const conflicts = await this.memoryExtractionService.detectConflicts(bookId, chapterId);
      progress += 5;
      await job.updateProgress(100);

      // 发布事件
      await this.eventBus.publish({
        type: EventType.MEMORY_EXTRACTION_COMPLETED,
        payload: { bookId, chapterId, eventsCount: events.length, conflicts },
      });

      const duration = Date.now() - startTime;
      this.logger.log(`Memory extraction completed in ${duration}ms`, {
        bookId, chapterId, extractionCount: events.length,
      });

      return { events, characterUpdates, foreshadowResults, settingUpdates, conflicts };
    } catch (error) {
      this.logger.error(`Memory extraction failed for chapter ${chapterNumber}`, {
        bookId, chapterId, error: error.message, attempt: job.attemptsMade,
      });
      throw error;  // BullMQ 将根据配置自动重试
    }
  }
}
```

### 17.4 API中间件管道

```
                    请求进入
                       │
                       ▼
              ┌────────────────┐
              │ 1. CORS 中间件   │  — 跨域处理
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │ 2. Helmet 中间件 │  — 安全头
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │ 3. 请求日志      │  — 记录请求基本信息
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │ 4. 限流检查      │  — 套餐级RPM/RPD校验
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │ 5. JWT 认证     │  — 提取用户身份
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │ 6. 套餐校验      │  — 检查功能权限
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │ 7. 参数校验      │  — DTO验证 (class-validator)
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │ 8. 控制器处理    │  — 业务逻辑
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │ 9. 响应转换      │  — 统一响应格式包装
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │ 10. 异常过滤     │  — 统一异常处理
              └───────┬────────┘
                      ▼
                   响应返回
```

```typescript
// NestJS 实现示例
// server/src/main.ts

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局中间件管道
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,                // 自动剥离非DTO定义字段
    forbidNonWhitelisted: true,     // 遇到未知字段抛出400错误
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),     // 统一响应格式包装
    new AuditInterceptor(),
  );
}
```

### 17.5 数据库迁移策略

```typescript
// TypeORM 迁移脚本命名规范: YYYYMMDDHHMMSS-description.ts
// 例: server/src/migrations/20260608120000-add-token-system.ts

import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddTokenSystem20260608120000 implements MigrationInterface {
  name = 'AddTokenSystem20260608120000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 创建表
    await queryRunner.createTable(new Table({
      name: 'token_packages',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'name', type: 'varchar', length: '100' },
        { name: 'token_amount', type: 'bigint' },
        { name: 'price', type: 'integer' },
        { name: 'is_active', type: 'boolean', default: true },
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
      ],
    }));

    // 种子数据
    await queryRunner.query(`
      INSERT INTO token_packages (name, token_amount, price, discount_label, sort_order)
      VALUES
        ('小额包', 50000, 900, NULL, 0),
        ('标准包', 200000, 2900, '最受欢迎', 1),
        ('大额包', 600000, 7900, '节省12%', 2),
        ('超大包', 2000000, 19900, '节省34%', 3)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('token_packages');
  }
}
```

---

## 18. DevOps 补充

### 18.1 生产环境 Docker Compose

```yaml
# docker-compose.prod.yml (Docker Compose v2+, 无需 version 字段)

x-logging: &default-logging
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "5"

x-healthcheck-postgres: &healthcheck-postgres
  test: ["CMD-SHELL", "pg_isready -U novel -d novel_assistant"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s

x-healthcheck-redis: &healthcheck-redis
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 10s

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: novel-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: novel_assistant
      POSTGRES_USER: novel
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_INITDB_ARGS: "--locale=C.UTF-8 --encoding=UTF8"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "127.0.0.1:5432:5432"          # 仅本地访问
    healthcheck: *healthcheck-postgres
    logging: *default-logging
    deploy:
      resources:
        limits:
          cpus: '8'
          memory: 32G
        reservations:
          cpus: '4'
          memory: 16G
    sysctls:
      - net.core.somaxconn=4096
    command: >
      postgres
      -c shared_preload_libraries=vectors.so
      -c max_connections=500
      -c shared_buffers=8GB
      -c effective_cache_size=24GB
      -c maintenance_work_mem=2GB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=64MB
      -c default_statistics_target=100
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
      -c work_mem=64MB
      -c min_wal_size=2GB
      -c max_wal_size=8GB
      -c max_worker_processes=16
      -c max_parallel_workers_per_gather=4
      -c max_parallel_workers=8

  redis:
    image: redis:7-alpine
    container_name: novel-redis
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --maxmemory 8gb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --save 60 10000
    volumes:
      - redisdata:/data
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck: *healthcheck-redis
    logging: *default-logging
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 16G
        reservations:
          cpus: '2'
          memory: 8G

  api:
    build:
      context: ./server
      dockerfile: Dockerfile
      target: production
    image: novel-assistant-api:${IMAGE_TAG:-latest}
    container_name: novel-api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://novel:${DB_PASSWORD}@postgres:5432/novel_assistant
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
      OSS_ENDPOINT: ${OSS_ENDPOINT}
      OSS_ACCESS_KEY: ${OSS_ACCESS_KEY}
      OSS_SECRET_KEY: ${OSS_SECRET_KEY}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      ALIPAY_APP_ID: ${ALIPAY_APP_ID}
      WECHAT_PAY_MCH_ID: ${WECHAT_PAY_MCH_ID}
      LOG_LEVEL: info
      SENTRY_DSN: ${SENTRY_DSN}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging: *default-logging
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G

  worker:
    build:
      context: ./server
      dockerfile: Dockerfile
      target: production
    image: novel-assistant-worker:${IMAGE_TAG:-latest}
    container_name: novel-worker
    restart: unless-stopped
    command: node dist/worker.js
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://novel:${DB_PASSWORD}@postgres:5432/novel_assistant
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
      LOG_LEVEL: info
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    logging: *default-logging
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

  nginx:
    image: nginx:1.25-alpine
    container_name: novel-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - api
    logging: *default-logging
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M

  prometheus:
    image: prom/prometheus:latest
    container_name: novel-prometheus
    restart: unless-stopped
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    ports:
      - "127.0.0.1:9090:9090"

  grafana:
    image: grafana/grafana:latest
    container_name: novel-grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro
    ports:
      - "127.0.0.1:3001:3000"
    depends_on:
      - prometheus

volumes:
  pgdata:
    driver: local
  redisdata:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
```

### 18.2 Kubernetes 部署配置概览

```yaml
# k8s/overview.md

# Kubernetes 部署架构
#
# ┌────────────────────────────────────────────────────────────────┐
# │                           Ingress                               │
# │               (Nginx Ingress / Traefik / Istio)                 │
# │              TLS终止 · 路由 · 限流 · WAF                        │
# └────────────────────┬───────────────────────────────────────────┘
#                      │
#          ┌───────────┴───────────┐
#          │                       │
# ┌────────▼──────┐       ┌───────▼───────┐
# │  API Service   │       │  WS Service    │
# │  (Deployment)  │       │  (Deployment)  │
# │  replicas: 3-10│       │  replicas: 2-5 │
# │  HPA: CPU 70%  │       │  HPA: CPU 60%  │
# └───────┬────────┘       └───────┬────────┘
#         │                        │
#         └───────────┬────────────┘
#                     │
#        ┌────────────┴────────────┐
#        │                         │
# ┌──────▼──────┐          ┌──────▼──────┐
# │  PostgreSQL  │          │   Redis      │
# │  (StatefulSet)│         │  (StatefulSet)│
# │  Primary +   │          │  Cluster     │
# │  ReadReplica │          │  mode        │
# └─────────────┘          └─────────────┘
```

```yaml
# k8s/api-deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: novel-api
  namespace: novel-assistant
  labels:
    app: novel-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 1
  selector:
    matchLabels:
      app: novel-api
  template:
    metadata:
      labels:
        app: novel-api
    spec:
      containers:
        - name: api
          image: registry.example.com/novel-assistant-api:${IMAGE_TAG}
          ports:
            - containerPort: 3000
              protocol: TCP
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: novel-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: novel-secrets
                  key: redis-url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: novel-secrets
                  key: jwt-secret
          resources:
            requests:
              cpu: "2"
              memory: "4Gi"
            limits:
              cpu: "4"
              memory: "8Gi"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 15
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: novel-api-hpa
  namespace: novel-assistant
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: novel-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
---
apiVersion: v1
kind: Service
metadata:
  name: novel-api-svc
  namespace: novel-assistant
spec:
  selector:
    app: novel-api
  ports:
    - port: 3000
      targetPort: 3000
      protocol: TCP
  type: ClusterIP
```

### 18.3 CI/CD 流水线设计

```yaml
# .github/workflows/ci-cd.yml

name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: registry.example.com
  IMAGE_NAME_API: novel-assistant-api
  IMAGE_NAME_WORKER: novel-assistant-worker

jobs:
  # ========== 阶段 1: 代码质量检查 ==========
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: ESLint (client)
        run: cd client && pnpm lint

      - name: ESLint (server)
        run: cd server && pnpm lint

      - name: TypeScript Check (client)
        run: cd client && pnpm typecheck

      - name: TypeScript Check (server)
        run: cd server && pnpm typecheck

      - name: TypeScript Check (shared)
        run: cd shared && pnpm typecheck

  # ========== 阶段 2: 测试 ==========
  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_DB: novel_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile

      - name: Unit Tests (server)
        run: cd server && pnpm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/novel_test
          REDIS_URL: redis://localhost:6379

      - name: Unit Tests (client)
        run: cd client && pnpm test

      - name: E2E Tests
        run: cd server && pnpm test:e2e
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/novel_test

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./server/coverage/lcov.info,./client/coverage/lcov.info
          flags: unittests

  # ========== 阶段 3: 构建与推送镜像 ==========
  build-and-push:
    name: Build & Push Images
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v4

      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME_API }}
          tags: |
            type=sha,prefix=,format=short
            type=ref,event=branch
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build and push API image
        uses: docker/build-push-action@v5
        with:
          context: ./server
          file: ./server/Dockerfile
          target: production
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ========== 阶段 4: 部署 ==========
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
    steps:
      - name: Deploy to staging K8s
        run: |
          # 使用 kubectl 或 helm 部署到 staging 环境
          echo "Deploying to staging..."
          # kubectl set image deployment/novel-api api=$REGISTRY/$IMAGE_NAME_API:${{ github.sha }}

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
    steps:
      - name: Deploy to production K8s
        run: |
          echo "Deploying to production..."
          # kubectl set image deployment/novel-api api=$REGISTRY/$IMAGE_NAME_API:${{ github.sha }}
```

### 18.4 监控与可观测性

#### 18.4.1 Prometheus 指标

```typescript
// server/src/common/metrics/metrics.service.ts

@Injectable()
export class MetricsService {
  constructor(private readonly prometheus: PrometheusService) {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    // === 业务指标 ===

    // 章节生成计数器
    this.chaptersGenerated = new Counter({
      name: 'novel_chapters_generated_total',
      help: 'Total number of chapters generated by AI',
      labelNames: ['model', 'tier', 'status'],
    });

    // 章节生成耗时直方图
    this.generationDuration = new Histogram({
      name: 'novel_generation_duration_seconds',
      help: 'Duration of AI chapter generation',
      labelNames: ['model', 'word_count_range'],
      buckets: [10, 20, 30, 45, 60, 90, 120, 180, 300],
    });

    // AI Token消耗计数器
    this.tokensConsumed = new Counter({
      name: 'novel_tokens_consumed_total',
      help: 'Total AI tokens consumed',
      labelNames: ['model', 'source', 'task_type'],
    });

    // 活跃用户数
    this.activeUsers = new Gauge({
      name: 'novel_active_users',
      help: 'Current number of active users',
      labelNames: ['tier'],
    });

    // 同步操作计数器
    this.syncOperations = new Counter({
      name: 'novel_sync_operations_total',
      help: 'Total sync operations',
      labelNames: ['operation', 'status'],
    });

    // === 技术指标 ===

    // HTTP请求耗时
    this.httpRequestDuration = new Histogram({
      name: 'novel_http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    });

    // 数据库查询耗时
    this.dbQueryDuration = new Histogram({
      name: 'novel_db_query_duration_seconds',
      help: 'Database query duration',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    });

    // 记忆检索耗时
    this.memoryRetrievalDuration = new Histogram({
      name: 'novel_memory_retrieval_duration_seconds',
      help: 'Memory retrieval duration',
      labelNames: ['retrieval_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });
  }
}
```

#### 18.4.2 关键告警规则

```yaml
# prometheus/alerting-rules.yml

groups:
  - name: novel-assistant
    rules:
      # === 服务可用性 ===
      - alert: HighErrorRate
        expr: rate(novel_http_request_duration_seconds_count{status_code=~"5.."}[5m]) / rate(novel_http_request_duration_seconds_count[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API错误率超过5%"
          description: "过去5分钟错误率为 {{ $value | humanizePercentage }}"

      - alert: ServiceDown
        expr: up{job="novel-api"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "API服务不可用"
          description: "实例 {{ $labels.instance }} 已下线超过2分钟"

      # === 性能指标 ===
      - alert: HighGenerationLatency
        expr: histogram_quantile(0.95, rate(novel_generation_duration_seconds_bucket[15m])) > 180
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "AI生成P95延迟过高"
          description: "P95生成延迟为 {{ $value }}秒，超过180秒阈值"

      - alert: HighDatabaseLatency
        expr: histogram_quantile(0.95, rate(novel_db_query_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "数据库查询P95延迟过高"
          description: "P95查询延迟为 {{ $value }}秒"

      # === 资源指标 ===
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes{container="novel-api"} / container_spec_memory_limit_bytes{container="novel-api"} > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "API容器内存使用率超过85%"

      # === 业务指标 ===
      - alert: AIProviderFailureRate
        expr: rate(novel_chapters_generated_total{status="failed"}[30m]) / rate(novel_chapters_generated_total[30m]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "AI模型生成失败率超过10%"
          description: "过去30分钟失败率为 {{ $value | humanizePercentage }}，检查AI Provider状态"

      - alert: TokenQuotaExhaustionRate
        expr: rate(novel_tokens_consumed_total{source="quota"}[1h]) > 100000
        for: 15m
        labels:
          severity: info
        annotations:
          summary: "Token消耗速率异常升高"
```

### 18.5 日志策略

```typescript
// server/src/common/logger/logger.config.ts

// 结构化日志格式
interface LogEntry {
  timestamp: string;          // ISO 8601
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  message: string;
  context?: string;           // 模块/服务名
  requestId?: string;         // 贯穿整个请求的追踪ID
  userId?: string;            // 关联用户
  traceId?: string;           // 分布式追踪ID
  spanId?: string;
  metadata?: Record<string, unknown>;
}

// 日志级别使用规范:
// error: 需要立即关注的问题（服务异常、数据库连接失败、支付失败）
// warn:  潜在问题（重试、降级、接近限额、性能下降）
// info:  正常业务事件（用户注册、章节生成、支付成功、同步完成）
// debug: 调试信息（SQL查询、API请求详情、缓存命中/未命中）
// trace: 极度详细（函数调用栈、完整请求响应体）-- 仅开发环境

// 日志采样策略（减少生产日志量）:
// - info级别：100% 记录
// - debug级别：1% 采样（或无采样仅开发环境）
// - AI生成请求：100% 记录（计费和审计需要）
// - 健康检查：完全跳过
```

```
日志收集架构:

  [API Pods] ── stdout ──→ [Fluentd DaemonSet]
  [Worker Pods] ── stdout ──→ [Fluentd DaemonSet]
                                  │
                                  ▼
                          [Elasticsearch Cluster]
                                  │
                                  ▼
                          [Kibana — 日志查询与可视化]
                                  │
                                  ▼
                     [告警规则: 异常日志频率检测]
```

### 18.6 备份与灾难恢复

```yaml
# 备份策略总览

PostgreSQL 备份:
  方法: pg_dump + WAL 归档
  全量备份: 每天一次 (03:00 UTC)
  增量备份: WAL 持续归档到 OSS
  保留策略:
    - 每日全量: 保留 30 天
    - 每周全量: 保留 12 周
    - 每月全量: 保留 12 个月
  RPO (恢复点目标): < 5 分钟 (WAL 归档)
  RTO (恢复时间目标): < 1 小时 (从最近全量+WAL 恢复)

Redis 备份:
  方法: RDB + AOF 持久化
  RDB: 每1小时一次 (save 3600 1)
  AOF: 每秒 fsync (appendfsync everysec)
  备份文件同步到 OSS: 每天一次

对象存储 (OSS/S3):
  方法: 跨区域复制 (Cross-Region Replication)
  版本控制: 开启，保留所有版本
  生命周期策略:
    - 导出文件: 30天后自动删除
    - 备份文件: 90天后转移到低频存储, 365天后删除
    - 用户上传: 永久保留

灾难恢复演练:
  频率: 每季度一次
  内容: 从备份完全恢复 → 验证数据完整性 → 应用启动验证
  文档: 每次演练更新恢复操作手册
```

### 18.7 云基础设施成本估算

```
基于 1000 活跃付费用户的月度成本估算
(单位: 人民币/月)

┌─────────────────────────────────────────────────────┐
│ 计算资源                                              │
├─────────────────────────────────────────────────────┤
│ API Server (4核8G × 3台)           ¥2,400           │
│ Worker Server (2核4G × 2台)        ¥1,200           │
│ 负载均衡器                          ¥500             │
│                              小计: ¥4,100           │
├─────────────────────────────────────────────────────┤
│ 数据库                                                │
├─────────────────────────────────────────────────────┤
│ PostgreSQL 主库 (8核32G)            ¥3,000           │
│ PostgreSQL 从库 (4核16G)            ¥1,200           │
│ Redis (4核16G)                     ¥1,500           │
│ 备份存储 (500GB)                    ¥200             │
│                              小计: ¥5,900           │
├─────────────────────────────────────────────────────┤
│ 存储与CDN                                             │
├─────────────────────────────────────────────────────┤
│ 对象存储 (OSS, 2TB)                ¥800             │
│ CDN 流量 (5TB/月)                  ¥1,200           │
│                              小计: ¥2,000           │
├─────────────────────────────────────────────────────┤
│ AI 服务                                               │
├─────────────────────────────────────────────────────┤
│ AI API调用 (预估5000万字/月)        ¥15,000 — ¥30,000 │
│ Embedding API调用                  ¥500             │
│                              小计: ¥20,000 (中位)    │
├─────────────────────────────────────────────────────┤
│ 监控与运维                                            │
├─────────────────────────────────────────────────────┤
│ Prometheus + Grafana               ¥500             │
│ 日志服务 (ELK)                      ¥1,500           │
│ 错误追踪 (Sentry)                   ¥300             │
│                              小计: ¥2,300           │
├─────────────────────────────────────────────────────┤
│                        月度总计: ¥34,300 — ¥50,000   │
│                    每活跃付费用户: ¥34 — ¥50          │
└─────────────────────────────────────────────────────┘

收入测算 (1000付费用户):
  假设用户分布: Free 60% (0) + Lite 15% (¥29) + Basic 10% (¥69)
               + Plus 10% (¥129) + Pro 5% (¥249)
  月订阅收入: 150×29 + 100×69 + 100×129 + 50×249
            = ¥4,350 + ¥6,900 + ¥12,900 + ¥12,450
            = ¥36,600
  Token增量包收入 (预估): ¥10,000 — ¥20,000
  月总收入: ¥46,600 — ¥56,600

  毛利: ¥46,600 - ¥34,300 ≈ ¥12,300 (约 26% 毛利率)
  → 随着用户规模增长，AI API成本可通过用量优化和大客户折扣降低
  → 盈亏平衡点预估: 约 800 付费用户
```

---

> **补充文档结束**。以上内容从产品管理、软件架构、前端、后端和DevOps五个维度对原始技术文档进行了全面补充。建议将各章节内容合并到主文档的对应位置，或将本文档作为独立的技术附录使用。


> **文档维护说明**: 本文档为AI智能小说生成助手项目的核心技术规格文档 v2.7。核心架构为**云端优先（Cloud-First）**。v2.6 新增 API用量管理层。v2.7 完成全代码库审计（90个TypeScript文件，15个模块），更新各模块实现状态、Phase完成度标记，并新增第19章完善方案。随着开发推进，请持续更新本文档。

---

## 19. 完善方案

> **来源**: v2.7 全代码库审计 + 记忆系统深度评估 + 文件格式方案设计
> **审计日期**: 2026-06-24
> **审计范围**: 15个后端模块（90个TS文件）、前端10个store + 20+组件、263KB技术文档对照

### 19.1 总体评估

```
项目整体完成度: ████████░░  ~65%

Phase 1-2 (基础+订阅):    ██████████  100%  全部完成
Phase 3   (记忆系统):     ████████░░   85%  核心到位，存在降级和Bug
Phase 4   (Agent系统):    ████████░░   80%  全部实现，但与记忆隔离
Phase 5   (离线+同步):    ████░░░░░░   40%  基础设施有，核心未实现
Phase 6   (高级功能):     ███░░░░░░░   30%  部分完成
Phase 7   (打磨发布):     ░░░░░░░░░░    0%  未开始
```

### 19.2 优先级分类

| 级别 | 含义 | 数量 |
|------|------|------|
| 🔴 P0 | 阻塞级 — 直接影响用户体验或系统正确性 | 3 |
| 🟡 P1 | 高优 — 核心体验的关键改进 | 7 |
| 🔵 P2 | 中优 — 体验提升和技术债务清理 | 7 |
| ⚪ P3 | 低优 — 架构演进和长期优化 | 5 |

---

### 19.3 P0 阻塞级（必须立即修复）

#### 🔴 P0-1: 流式生成路径丢失记忆上下文

**位置**: `server/src/modules/ai/ai.controller.ts:84-88`

**问题**: SSE 流式生成端点 `POST /ai/generate-content` 的 Prompt 构建完全**未调用** `MemoryService.assembleContext()`。当前所有前端触发的章节生成（用户实际使用的路径）均未注入记忆上下文，记忆系统形同虚设。

**对比**:
- `ai.service.ts:generateContent()`（非流式）✅ 正确调用了 assembleContext
- `ai.controller.ts:generateContent()`（流式SSE）❌ 完全缺失

**修复方案**:
```typescript
// ai.controller.ts 的 generateContent 方法中，在构建Prompt之前插入：
const ctx = await this.aiService.assembleContext(body.bookId, body.chapterId, user.plan);
const { systemPrompt, userMessage } = this.promptTemplate.buildChapterGenerationPrompt({
  chapterOutline: body.chapterOutline,
  instruction: body.instruction,
  targetWordCount: body.targetWordCount,
  contextSummary: ctx ? [
    ctx.recentSummary,
    ctx.activeForeshadows ? `活跃伏笔:\n${ctx.activeForeshadows}` : '',
    ctx.characterStates ? `角色状态:\n${ctx.characterStates}` : '',
    ctx.relevantMemories ? `相关记忆:\n${ctx.relevantMemories}` : '',
  ].filter(Boolean).join('\n\n') : undefined,
});
```

**影响范围**: 1 处代码修改，影响所有章节生成请求

---

#### 🔴 P0-2: assembleContext 返回字段未完整使用

**位置**: `server/src/modules/ai/ai.service.ts:67-71`

**问题**: `MemoryService.assembleContext()` 返回 4 个字段（`recentSummary`、`activeForeshadows`、`characterStates`、`relevantMemories`），但调用方只拼接了前 2 个，角色状态和长期记忆被丢弃。

**修复方案**: 将 4 个字段全部注入 contextSummary（见 P0-1 的代码示例）。

---

#### 🔴 P0-3: Agent 系统与记忆系统完全隔离

**位置**: `server/src/modules/ai/agents/orchestrator.service.ts` + 5 个 Agent 的 `buildPrompt()`

**问题**: 
- 5 个 Agent 的 `buildPrompt()` 方法零引用记忆服务
- `OrchestratorService.preGenerate()` 没有调用 `MemoryService.assembleContext()`
- 文档设计的完整流水线 "Orchestrator → 记忆管家 → 文风模拟师 → 架构师 → 组装Prompt" 未实现

**修复方案**:
1. 在 `OrchestratorService.preGenerate()` 中注入记忆上下文
2. 修改 `BaseAgent.execute()` 接口，增加可选的 `memoryContext` 参数
3. 在各 Agent 的 `buildPrompt()` 中使用记忆上下文

---

### 19.4 P1 高优先级（核心体验改进）

#### 🟡 P1-1: Prompt 模板升级

**位置**: `server/src/modules/ai/prompt-template.service.ts`

**问题**: System prompt 仅包含 6 条通用写作要求，未注入：
- 当前作品的角色列表和状态
- 活跃伏笔和预期回收节点
- 世界观设定摘要
- 风格参数（文风模拟师的产出未接入）

**方案**: 引入结构化 Prompt 模板，包含角色段、设定段、伏笔段、风格段。

---

#### 🟡 P1-2: 补齐记忆提取缺失功能

**位置**: `server/src/modules/memory/memory-extraction.service.ts`

**需补齐**:
| 功能 | 文档设计 | 当前状态 |
|------|---------|---------|
| 物品/货币追踪 | ✅ 设计 | ❌ 未实现 |
| 主支线进度更新 | ✅ 设计 | ❌ 未实现 |
| 角色交互记录 | ✅ 设计 | ❌ 未实现 |
| 风格锚点自动提取 | ✅ 设计 | 实体已建，逻辑为空 |

---

#### 🟡 P1-3: 迁移到 pgvector 原生 SQL 检索

**位置**: `server/src/modules/memory/vector-search.service.ts`

**问题**: 当前 `search()` 方法将整本书所有记忆事件全量加载到内存中做 JS 层余弦相似度计算。长篇作品（500万字）的事件数量增长后，性能会线性退化。

**方案**: 
1. MemoryEvent 实体的 `embedding` 字段改为 pgvector 原生 `vector(1536)` 类型
2. 检索逻辑改为 SQL 查询：`ORDER BY embedding <=> $query_embedding`
3. 建立 IVFFlat 索引加速

---

#### 🟡 P1-4: 增加中文全文搜索

**位置**: `server/src/modules/memory/vector-search.service.ts:keywordScore()`

**问题**: 当前 `keywordScore()` 用简单的 `split()` + `includes()` 做关键词匹配，对中文支持极弱（无分词、无语义）。

**方案**:
1. PostgreSQL 安装 `zhparser` 中文分词扩展
2. Chapters/Characters 表增加 `tsvector` 生成列
3. 混合检索中集成 `ts_rank` + `plainto_tsquery('chinese', ...)`

---

#### 🟡 P1-5: 引入检索结果重排序

**位置**: 向量检索链路

**问题**: 检索返回 Top 20 后直接按粗排分数返回，无精排阶段。事件数量大时，Top 5 精度无保证。

**方案**: 粗排（向量+关键词 Top 20）→ 精排（轻量 Cross-encoder 或 LLM 评分 Top 5）→ 返回

---

#### 🟡 P1-6: 文件格式规范制定与双向转换器

**问题**: 当前所有数据散落在 PostgreSQL 关系表中，缺乏自描述的文件格式。

**方案**: 参见 19.7 节文件格式方案。实现 PostgreSQL ↔ Markdown+YAML 双向转换器。

---

#### 🟡 P1-7: Prompt 上下文压缩

**问题**: 随着章节增多，短期记忆（最近 3 章摘要）+ 活跃伏笔 + 角色状态 + 相关记忆的总体 Token 消耗会持续膨胀。

**方案**: 在注入 Prompt 前增加压缩层——对组装好的上下文做 LLM 摘要压缩，控制在上限 Token 内（如 2000 Token）。

---

### 19.5 P2 中优先级（体验提升和债务清理）

#### 🔵 P2-1: 前端 LeftSidebar 拆分

**位置**: `client/src/components/layout/LeftSidebar.tsx` (~620 行)

**问题**: 该组件内联了书籍/分卷/章节的几乎所有 CRUD 逻辑、右键菜单、批量管理、新建弹窗等多个职责。

**方案**: 拆分为 `useBookActions`、`useVolumeActions`、`useChapterActions` 三个自定义 Hook，提取 `BookTree`、`VolumeTree`、`ChapterItem` 子组件。

---

#### 🔵 P2-2: 合并 BookCreateDialog 与 BookEditDialog

**位置**: `client/src/components/layout/BookCreateDialog.tsx` + `BookEditDialog.tsx`

**问题**: 两个组件功能高度重叠（编辑书名/作者/标签），前者多了封面上传。

**方案**: 合并为 `BookFormDialog`，通过 `mode: 'create' | 'edit'` prop 区分行为。

---

#### 🔵 P2-3: project.store 补充业务 Action

**位置**: `client/src/stores/project.store.ts`

**问题**: `project.store` 仅有 setter 方法，所有 `apiClient` CRUD 调用直接写在 LeftSidebar 组件中。

**方案**: 在 store 中增加 `loadBooks`、`createBook`、`deleteBook`、`loadVolumes` 等 action 方法，组件仅调用 action。

---

#### 🔵 P2-4: 剔除 any 类型

**位置**: 多个组件（BookCreateDialog、LeftSidebar、CharacterList 等）

**问题**: 大量 `book: any`、`data: any` 等不严格类型。

**方案**: 引入 `shared/src/types/` 中已定义的类型接口，替换所有 `any`。

---

#### 🔵 P2-5: 实现角色关系图可视化

**位置**: `client/src/components/characters/CharacterList.tsx` + `character.store.ts`

**问题**: 后端 API `/character-graph` 已实现，前端 `loadGraph` 已调用并获取 nodes+edges 数据，但无图形化渲染。

**方案**: 引入轻量级图形库（如 `@xyflow/react` 或 D3.js force graph）渲染关系图。

---

#### 🔵 P2-6: 搜索升级为后端 API 搜索

**位置**: `client/src/components/layout/SearchDialog.tsx`

**问题**: 当前搜索为客户端数据过滤，大数据量不可靠。

**方案**: 新增 `GET /search?q=xxx&bookId=xxx` 后端 API，使用 FTS 全文索引。

---

#### 🔵 P2-7: 导出格式完善

**位置**: `server/src/modules/export/`

**问题**: 仅支持 TXT 和简易 Word（HTML 包装为 .doc），缺少 EPUB、真正的 .docx、PDF 格式。

**方案**: 引入 `docx` npm 包实现真正的 .docx；引入 `epub-gen` 或类似库实现 EPUB。

---

### 19.6 P3 低优先级（架构演进）

#### ⚪ P3-1: BullMQ 异步队列

将记忆提取从同步调用改为 BullMQ 异步队列，Worker 独立进程处理，不阻塞用户生成流程。

#### ⚪ P3-2: Redis 短期记忆缓存

`MemoryService.assembleContext()` 每次查询数据库。引入 Redis 缓存层，对"最近 3 章摘要"、"活跃伏笔列表"等高频数据做 TTL 缓存。

#### ⚪ P3-3: WebSocket 实时同步

实现 `sync.gateway.ts`，用 Socket.io 实现多端实时协作推送。

#### ⚪ P3-4: 离线 SQLite 本地存储

Electron 客户端集成 SQLite，实现完整的离线创作→联网增量同步闭环。

#### ⚪ P3-5: GraphRAG 知识图谱

对角色关系、事件因果链、伏笔推进链构建知识图谱，支持"为什么"类推理查询（如"白泽为什么在 ch-025 中做出那个决定"）。

---

### 19.7 文件格式方案（Markdown + YAML Frontmatter）

#### 19.7.1 作品目录结构

```
workspaces/
└── {book-uuid}-{书名}/
    ├── book.yaml                    # 📋 作品清单（入口文件）
    ├── chapters/                    # 📝 章节
    │   └── vol-01/
    │       └── ch-001-章节名.md
    ├── characters/                  # 👤 角色档案
    │   └── 角色名.md
    ├── worldbuilding/              # 🌍 世界观设定
    │   ├── locations/
    │   └── systems/
    ├── outlines/                   # 📊 大纲
    ├── memory/                     # 🧠 记忆索引（自动生成）
    │   ├── events/
    │   ├── foreshadows/
    │   ├── character-states/
    │   └── _index.yaml
    └── exports/                    # 📦 导出目录
```

#### 19.7.2 章节文件格式

```markdown
---
id: "ch-uuid-001"
type: "chapter"
title: "青云山初遇"
volume_id: "vol-1"
chapter_number: 1
word_count: 3247
status: "published"
characters:
  - ref: "characters/陈凡.md"
  - ref: "characters/白泽.md"
locations:
  - ref: "worldbuilding/locations/青云山.md"
events:
  - id: "evt-001"
    title: "陈凡突破大罗金仙"
    type: "turning_point"
    importance: 9
new_foreshadows:
  - ref: "memory/foreshadows/fs-001-天道的真实身份.md"
---

# 第1章 青云山初遇

## 场景一：山门试炼

陈凡站在青云山的山门前...[[角色/白泽]]突然出现...

<!-- memory:event id="evt-001" type="turning_point" 
     title="陈凡突破大罗金仙" importance=9 -->
陈凡体内灵气突然暴走...大罗金仙的境界轰然突破。
<!-- /memory:event -->
```

#### 19.7.3 三层关联机制

| 层级 | 格式 | 用途 |
|------|------|------|
| Wiki链接 | `[[角色/陈凡]]` | 人类可读，编辑器自动补全和跳转 |
| Frontmatter引用 | `characters: [{ref: "..."}]` | 程序精确解析，双向同步 |
| HTML注释标记 | `<!-- memory:event ... -->` | 记忆系统细粒度语义标注 |

#### 19.7.4 架构定位

```
┌──────────────────────────────────────┐
│  PostgreSQL (运行时主存储)             │
│  · 事务一致性 · 多端同步 · 权限控制    │
└──────────┬───────────────────────────┘
           │ 双向同步 (Builder)
┌──────────▼───────────────────────────┐
│  文件系统 (工作区存储)                  │
│  · 离线编辑 · Git版本控制              │
│  · LLM直接消费 · 导出/备份             │
│  · 语义分块源                         │
└──────────────────────────────────────┘
```

#### 19.7.5 对记忆系统的增强

| 改进点 | 当前 | 文件格式方案后 |
|--------|------|---------------|
| 语义分块 | 按固定字数切分 | Markdown `##` 标题天然分块边界 |
| 元数据提取 | LLM 后提取 | Frontmatter 直接结构化索引 |
| 交叉引用 | 仅 UUID 外键 | `[[链接]]` 自动展开为聚合视图 |
| 记忆标记 | 无 | `<!-- memory:event -->` 精确标注 |

---

### 19.8 实施路线图

```
Week 1-2 (P0 修复):
├── P0-1: 修复流式路径记忆注入
├── P0-2: 补全 assembleContext 4字段使用
└── P0-3: Agent 接入记忆上下文

Week 3-6 (P1 高优):
├── P1-1: Prompt 模板升级
├── P1-2: 补齐记忆提取缺失功能（物品/进度/交互记录）
├── P1-6: 制定文件格式规范 + 实现转换器
└── P1-7: 上下文压缩

Week 7-12 (P1+P2):
├── P1-3: pgvector 原生 SQL 检索
├── P1-4: 中文全文搜索 (zhparser)
├── P1-5: 检索结果重排序
├── P2-1: LeftSidebar 拆分
├── P2-3: project.store 补充Action
└── P2-5: 角色关系图可视化

Week 13+ (P2+P3):
├── P2-2: 合并BookCreateDialog+BookEditDialog
├── P2-4: 剔除any类型
├── P2-6: 后端API搜索
├── P2-7: EPUB/PDF导出
└── P3-1: BullMQ异步队列

远期 (P3):
├── P3-2: Redis短期记忆缓存
├── P3-3: WebSocket实时同步
├── P3-4: 离线SQLite
└── P3-5: GraphRAG知识图谱
```

---

> **完善方案结束**。本章基于 v2.7 全代码库审计结果编写，共识别 3 个 P0 阻塞问题、7 个 P1 高优改进、7 个 P2 中优改进、5 个 P3 远期演进项。建议按实施路线图分阶段推进。
