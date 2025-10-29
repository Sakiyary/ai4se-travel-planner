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
| 语音合成（可选） | **科大讯飞语音合成 API** | 为行程结果提供语音播报与确认。 |
| 地图与 POI | **高德地图 Web JS API** | 覆盖全国，POI 检索与路线规划能力强。 |
| 认证与数据库 | **Supabase（Auth + Postgres）** | 托管认证+社交登录，Postgres 提供行级安全，客户端 SDK 易用。 |
| 对象存储 | **Supabase Storage** | 用于存储行程导出、上传票据与语音笔记。 |
| 行程规划与预算 | **阿里云通义千问 DashScope (Qwen-Plus)** | 与助教批改时的密钥兼容，具备本地化知识与预算估算优势。 |
| 后端运行时 | **Next.js API Routes（Node.js 20）** | 与前端同仓维护，可在 Docker 中运行，后续可平滑迁移至 Supabase Edge Functions。 |
| 费用分析 | **Supabase Postgres 函数 + Edge Functions** | 无需独立后端即可实现轻量级聚合。 |
| CI/CD | **GitHub Actions** | 自动化执行 lint/测试/构建，构建 Docker 镜像并推送至阿里云镜像仓库。 |
| 容器化 | **Docker（多阶段 Node 20 Alpine）** | 生成便于评分或自托管的可移植镜像。 |

## 4. 高层架构

```text
[客户端浏览器]
  |-- Next.js 应用（React + Chakra UI） --|        |-- Supabase 认证（JWT）
  |                                       --> API 层（Next.js API Routes / Node.js 运行时）
  |-- 语音录制（Web Speech API 封装）           --> 科大讯飞 ASR/TTS
  |-- 地图画布（高德 JS SDK）                    --> 通义千问 LLM (Qwen-Plus)
  |                                              --> Supabase（Postgres + Storage）
  |                                              --> Supabase Edge Functions（费用分析）
```

## 5. 模块划分

- **前端**
  - `app/`（Next.js App Router）路由包括：`login`、`dashboard`、`plans/[planId]`、`planner`、`expenses`。
  - 组件：`VoiceInput`、`ItineraryTimeline`、`BudgetSummary`、`MapView`、`ExpenseList`、`PlanCard`。
  - 自定义 Hook：`usePlanGenerator`、`useSpeech`、`useSupabaseAuth`。
  - 样式：Chakra 主题扩展 + Tailwind 工具类组合布局。
  - 客户端校验：`react-hook-form` 搭配 `zod` Schema。

- **后端 API（Next.js `/api` 路由）**
  - `POST /api/auth/callback`：交换 Supabase 认证令牌。
  - `POST /api/planner/generate`：编排 DashScope 提示词，整合高德 POI 数据并写入 Supabase。
  - `POST /api/speech/transcribe`：上传语音切片至科大讯飞并返回文本，同时将转写缓存至 Supabase Storage。
  - `POST /api/expenses/record`：写入费用条目，触发 Supabase Edge Function 汇总分类。
  - `GET /api/plans/:planId`：读取行程、POI 与费用数据。
  - 共用工具：Supabase 服务端客户端、密钥管理、提示模板。

- **Supabase Edge Functions**
  - `expenses-rollup`：按日刷新费用类别聚合数据。
  - `plan-sharing`：生成行程只读分享的签名链接。

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
- **安全护栏**：温度控制在 0.5 以下保证预算稳定，设置最大 Token；客户端加入敏感词过滤后再提交。

## 8. 语音交互流程

1. 用户通过浏览器 MediaRecorder 录音。
2. 语音切片上传至 `POST /api/speech/transcribe`。
3. 无服务器函数转发至科大讯飞 ASR 并获取文本。
4. 将转写结果返回前端，可选存入 `voice_notes` 并生成临时签名 URL。
5. 前端展示转写文本，允许编辑后触发行程生成。

可选的 TTS：行程更新时，调用 `POST /api/speech/synthesize` 返回播报链接，使用科大讯飞语音合成播放。

## 9. 地图集成

- 在 `MapView` 组件内嵌高德 Web JS SDK。
- 无服务器辅助接口 `GET /api/poi/search` 将 POI 结果缓存至 Supabase，降低 API 调用频率。
- 行程段落包含 `location_id` 字段，映射高德 POI 以支持地图高亮。

## 10. 安全与密钥管理

- 在 `.env` 与 `.env.local` 中管理敏感配置，并通过 Docker 环境变量（或 Compose 文件）映射到容器运行时。
- 前端使用 Supabase 匿名密钥并受 RLS 约束；无服务器函数在受保护的运行时内使用 Service Role 密钥。
- 语音文件通过临时签名的 Supabase Storage URL 上传，限制有效期。
- 提示词输入做净化以缓解提示注入，并使用 `zod` 校验模型输出后再入库。

## 11. 部署与 DevOps

- GitHub Actions 流程：
  1. 使用 `pnpm` 安装依赖。
  2. 执行 `eslint`、`tsc` 与 `vitest`。
  3. 构建 Next.js 应用并产出 `.next` 目录。
  4. 构建 Docker 镜像（多阶段 Node 20 Alpine），并推送至阿里云镜像仓库（`registry.cn-hangzhou.aliyuncs.com/ai4se/travel-planner`）。
  5. 在评分或演示环境中拉取镜像，通过 `docker run` 启动服务。

## 12. 本地开发流程

1. 执行 `pnpm install`。
2. 复制 `.env.example` 为 `.env.local`，填写 Supabase 匿名密钥、DashScope 密钥、科大讯飞凭据。
3. 运行 `pnpm dev` 启动 Next.js 开发服务器。
4. 需要离线测试时，可使用 Supabase CLI 的 `supabase start` 启动本地 Postgres。
5. 使用 `pnpm test` 运行单元测试，核心流程通过 Playwright 做端到端测试。

本设计契合原始需求，围绕语音输入、AI 行程生成、预算支持、用户账户体系以及云端同步打造无服务器架构。所选技术栈兼顾开发效率、本地化能力与部署便利性，可满足课程评分需求。
