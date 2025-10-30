# AI 旅行规划师设计文档

## 1. 产品概览

AI 旅行规划师是一款无服务器 Web 应用，旨在简化行程规划流程。用户可通过语音或文本表达出行需求，系统将生成 AI 驱动的个性化行程、费用预算以及持续的开销跟踪。所有计划存储于云端，支持多设备访问，并整合适合中国市场的地图与语音服务，为本地用户提供友好体验。

## 2. 目标用户与使用场景

- **忙碌的职场人士**：需要快速获得个性化行程与预算。
- **家庭用户**：需要协调多人差异化偏好与行程安排。
- **旅行爱好者**：希望获得灵感、逐日细节与费用管控能力。
- **移动优先用户**：依赖语音输入随时更新或调整计划。

## 3. 技术栈选型

| 层级 | 技术 | 选型理由 |
| --- | --- | --- |
| 前端框架 | **Next.js 15 (React, TypeScript)** | 适配无服务器部署，支持 SSG/SSR 混合渲染，生态成熟，TypeScript 提升安全性。 |
| UI 框架 | **Chakra UI + Tailwind CSS** | 快速构建组件，具备可访问性默认值，便于打造旅游视觉风格。 |
| 状态管理 | **React Query (TanStack Query)** | 简化无服务器场景的数据获取、缓存与同步。 |
| 语音识别 | **科大讯飞语音识别 API** | 普通话识别准确，SDK 完善，按量计费。 |
| 地图与 POI | **高德地图 Web JS API** | 覆盖全国，POI 检索与路线规划能力强。 |
| 认证与数据库 | **Supabase（Auth + Postgres）** | 托管认证+社交登录，Postgres 提供行级安全，客户端 SDK 易用。 |
| 对象存储 | **Supabase Storage** | 用于存储行程导出、上传票据与语音笔记。 |
| 行程规划与预算 | **阿里云通义千问 DashScope (Qwen-Plus)** | 与助教批改时的密钥兼容，具备本地化知识与预算估算优势。 |
| 运行方式 | **Next.js 15 静态导出 + Node.js 运行容器** | 仅托管前端与静态资源，不配置自定义 API，Docker 镜像用于评分演示。 |
| 费用分析 | **前端预算引擎（TypeScript）+ Supabase SQL 视图** | 在浏览器端计算预算拆分，必要时通过数据库视图做汇总。 |
| CI/CD | **GitHub Actions** | 自动化执行 lint/测试/构建，并将 Docker 镜像推送到 GitHub Container Registry (GHCR)。 |
| 容器化 | **Docker（多阶段 Node 20 Alpine）** | 生成便于评分或自托管的可移植镜像。 |

## 4. 高层架构

```text
[客户端浏览器]
  |-- Next.js 应用（React + Chakra UI） --|        |-- Supabase 认证（JWT）
  |                                       --> Supabase Postgres / Storage
  |-- 语音录制（Web Speech API 封装）           --> 科大讯飞 ASR
  |-- 地图画布（高德 JS SDK）                    --> 通义千问 LLM (Qwen-Plus)
  |                                              --> 高德在线服务（POI / 路线）
```

## 5. 模块划分

- **前端**
  - `app/`（Next.js App Router）路由包括：`login`、`dashboard`、`plans/[planId]`、`planner`、`expenses`、`profile`。
  - 组件：`VoiceInput`、`ItineraryTimeline`、`BudgetSummary`、`MapView`、`ExpenseList`、`PlanCard`、`ExpenseQuickAddModal`（语音笔记一键转费用）。
  - 用户资料页：`app/profile/page.tsx` 提供昵称、默认币种与默认同行人数的基础表单，并展示最近的 `audit_logs` 记录便于追踪 AI 操作。
  - 计划详情页：`app/plans/[planId]/page.tsx` 支持语音笔记、费用联动，并提供 Markdown/JSON/PDF 导出功能。
  - 自定义 Hook：`useSpeech`、`useSupabaseAuth`。
  - 样式：Chakra 主题扩展 + Tailwind 工具类组合布局。
  - 客户端校验：`react-hook-form` 搭配 `zod` Schema。

- **前端数据服务层**
  - `services/llm.ts`：封装 DashScope 请求与提示模板，并在本地请求成功后追加审计日志。
  - `services/speech.ts`：管理科大讯飞 SDK 调用与音频上传逻辑。
  - `services/storage.ts`：使用 Supabase JS 客户端读写计划、费用、语音笔记。
  - `lib/supabaseQueries.ts`：集中封装 Supabase 数据访问与 React Query 使用的查询函数。

## 6. 数据模型（Supabase Postgres）

| 数据表 | 关键字段 | 说明 |
| --- | --- | --- |
| `profiles` | `id (uuid PK)`、`email`、`display_name`、`preferences (jsonb)` | 与 Supabase Auth 用户关联。 |
| `plans` | `id (uuid)`、`user_id`、`title`、`destination`、`start_date`、`end_date`、`party_size`、`budget`、`created_at` | AI 生成行程后的主记录。 |
| `plan_segments` | `id`、`plan_id`、`day_index`、`time_slot`、`activity_type`、`details (jsonb)` | 逐日行程明细。 |
| `expenses` | `id`、`plan_id`、`amount`、`currency`、`category`、`method`、`timestamp`、`source` | 支持手动或 AI 生成的费用条目。 |
| `voice_notes` | `id`、`plan_id`、`storage_path`、`transcript`、`duration`、`created_at` | 关联语音输入与 Supabase Storage 对象。 |
| `audit_logs` | `id`、`user_id`、`action`、`metadata (jsonb)`、`created_at` | 记录 AI 提示的审计信息。 |

行级安全策略（RLS）确保用户仅能访问自己的数据。

## 7. AI 提示策略

- **行程提示词**：整合标准化用户偏好、高德 POI 候选、预算约束、亲子/老人友好标签。
- **预算提示词**：通过 DashScope 函数调用请求结构化 JSON，按交通、住宿、餐饮、活动、备用金等拆分成本。
- **费用摘要**：在聚合任务后生成每日亮点文本。
- **语音记账衔接**：保留语音笔记原文并调用本地解析器（`voiceExpenseParser`）推测金额、分类等字段，作为 `ExpenseQuickAddModal` 的默认值。
- **安全护栏**：温度控制在 0.5 以下保证预算稳定，设置最大 Token；客户端加入敏感词过滤后再提交。

## 8. 语音交互流程

1. 用户通过浏览器 MediaRecorder 录音。
2. 前端使用科大讯飞 Web API（WebSocket/HTTP）上传音频切片。
3. 浏览器端接收转写文本，并在本地做轻量清洗与截断。
4. 将音频文件与转写结果通过 Supabase Storage / 数据库保存，以便多端同步。
5. 前端展示转写文本，允许编辑后触发行程生成。

## 9. 地图集成

- 在 `MapView` 组件内嵌高德 Web JS SDK。
- 通过 React Query + 高德 Web JS API 进行 POI 查询，并在 IndexedDB 中缓存结果以降低重复请求。
- 行程段落包含 `location_id` 字段，映射高德 POI 以支持地图高亮。

## 10. 安全与密钥管理

- 在 `.env` 中管理敏感配置，并通过 Docker 环境变量（或 Compose 文件）映射到容器运行时。
- 前端使用 Supabase 匿名密钥并受 RLS 约束；Service Role 密钥仅用于数据库迁移脚本和 CI 任务，不会进入客户端。
- 语音文件通过临时签名的 Supabase Storage URL 上传，限制有效期。
- 提示词输入做净化以缓解提示注入，并使用 `zod` 校验模型输出后再入库。
- DashScope API Key 通过 Docker 环境变量注入运行容器；课程环境直接在客户端调用，如投入生产建议改为服务端代理以避免密钥外泄。
- 关键的 AI 操作（行程生成、保存、语音转费用等）会写入 `audit_logs` 表，以便用户在前端查询审计 trail。

## 11. 部署与 DevOps

- GitHub Actions 流程：
  1. 使用 npm 安装依赖。
  2. 执行 `eslint`、`tsc` 与 `vitest`。
  3. 构建 Next.js 应用并产出 `.next` 目录。
  4. 构建 Docker 镜像（多阶段 Node 20 Alpine），并推送至 GitHub Container Registry（`ghcr.io/<owner>/<repo>/travel-planner`）。
  5. 评分或演示环境可直接拉取 GHCR 镜像，通过 `docker run` 启动服务。

## 12. 本地开发流程

1. 执行 `pnpm install`。
2. 复制 `.env.example` 为 `.env`，填写 Supabase 匿名密钥、DashScope 密钥、科大讯飞凭据。
3. 运行 `pnpm dev` 启动 Next.js 开发服务器。
4. 需要离线测试时，可使用 Supabase CLI 的 `supabase start` 启动本地 Postgres。
5. 使用 `pnpm test` 运行单元测试，核心流程通过 Playwright 做端到端测试。

本设计契合原始需求，围绕语音输入、AI 行程生成、预算支持、用户账户体系以及云端同步打造无服务器架构。所选技术栈兼顾开发效率、本地化能力与部署便利性，可满足课程评分需求。
