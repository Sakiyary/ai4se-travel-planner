# 平台接入清单

为完成 AI 旅行规划师的部署与测试，需要在以下平台准备账号、密钥与相关资源。此文档按优先级与功能分类列出所需内容，并给出申请路径及注意事项。

## 1. 科大讯飞开放平台

- **用途**：语音识别（ASR）。
- **必备资源**：
  - 应用 ID（AppID）
  - API Key（语音识别）
  - API Secret（语音识别）
- **申请步骤**：
  1. 访问 [https://www.xfyun.cn/](https://www.xfyun.cn/)，注册并完成实名认证。
  2. 创建语音听写（流式版）应用，获取 ASR 所需的 AppID、API Key、API Secret。
- **注意事项**：
  - 免费额度有限，注意控制调用频率。
  - 需在后台绑定服务器 IP 或配置白名单，避免被判定为异常调用。
  - 当前实现直接在前端通过 WebSocket 调用语音听写 API，部署时需知 AppID / API Key / API Secret 会在客户端暴露。

## 2. 阿里云百炼·通义千问（DashScope）

- **用途**：行程规划与预算生成核心 LLM。
- **必备资源**：
  - DashScope API Key（Qwen-Plus 模型）
  - 账号内的可用额度或套餐
- **申请步骤**：
  1. 登录 [https://dashscope.aliyun.com/](https://dashscope.aliyun.com/) 并使用阿里云账号开通服务。
  2. 在“API Key 管理”页面新建密钥。
  3. 确认 Qwen-Plus 模型已开通，若无免费额度需预购套餐或申请学术/教学支持。
- **注意事项**：
  - 助教会提供可用的测试 Key，如自行申请，请在课业周期内保持密钥有效。
  - 根据 DashScope 限流策略设置调用频率与重试机制。

## 3. Supabase

- **用途**：用户认证、Postgres 数据库、对象存储。
- **必备资源**：
  - Supabase 项目 URL
  - 匿名密钥（anon key）
  - Service Role 密钥（仅在受保护的后端使用）
  - Storage Bucket（用于语音/行程导出）
- **申请步骤**：
  1. 访问 [https://supabase.com/](https://supabase.com/)，注册后创建新项目。
  2. 在 Project Settings → API 页面复制 Project URL、anon key。
  3. 在 Storage 模块创建 `voice-notes`、`plan-exports` 等 Bucket。
- **注意事项**：
  - Service Role 密钥仅存储于服务器端环境变量，不得写入客户端。

## 4. 高德开放平台

- **用途**：地图展示、路线规划、POI 检索。
- **必备资源**：
  - Web 端 Key（用于前端地图展示）
  - Web 服务 Key（用于服务器端 POI/路径请求）
- **申请步骤**：
  1. 登录 [https://lbs.amap.com/](https://lbs.amap.com/)，完成企业或个人认证。
  2. 在控制台创建“Web 端（JS API）”与“Web 服务”应用，分别获取两个 Key。
  3. 为 Web 端 Key 配置域名白名单（如 `localhost`、正式域名），此处为方便助教批改，均留空。
- **注意事项**：
  - Web 服务 Key 不应暴露在前端。
  - 调用频率受套餐限制，确保缓存策略有效降低请求次数。

## 5. 本地 Docker 运行环境

- **用途**：本地运行评分所需的容器镜像，提供统一的运行时环境。
- **必备资源**：
  - Docker Desktop 或兼容的容器运行时
  - `.env` 或 `docker-compose.yml` 中的环境变量配置
- **准备步骤**：
  1. 安装最新版本的 Docker Desktop（Windows / macOS）或 Docker Engine（Linux）。
  2. 确保 `docker` 与 `docker compose` 命令可正常运行。
  3. 在仓库根目录创建 `.env` 文件，填写 Supabase、DashScope、科大讯飞等密钥。
  4. 通过 `docker build` 构建镜像，或使用 GitHub Actions 产出的镜像直接 `docker pull`。
  5. 使用 `docker run --env-file .env -p 3000:3000 <image>` 启动应用并完成联调。
- **注意事项**：
  - 建议在 `.env` 中仅保留课程评分所需的最小密钥集。
  - 若需要多服务协同，可编写 `docker-compose.yml` 管理依赖（如本地 Supabase 模拟器）。

## 6. 阿里云容器镜像服务（ACR）

- **用途**：存储课程要求的 Docker 镜像。
- **必备资源**：
  - ACR 实例地址（如 `registry.cn-hangzhou.aliyuncs.com`）
  - 命名空间与仓库名称（例如 `ai4se/travel-planner`）
  - 登录凭据（阿里云账号或临时 Token）
- **申请步骤**：
  1. 登录阿里云控制台，进入容器镜像服务（个人版/企业版皆可）。
  2. 创建命名空间与公开/私有仓库。
  3. 在“访问凭证”页面获取 Docker 登录命令。
- **注意事项**：
  - GitHub Actions 中需使用 `aliyun/acr-login` 或 `docker login` 写入登录凭据。
  - 若仓库设为私有，需向助教提供访问权限或临时 Token。

## 7. GitHub

- **用途**：代码托管、CI/CD、Issue 跟踪。
- **必备资源**：
  - 私有或公开仓库（符合课程要求）
  - GitHub Actions 执行权限
  - 外部 Secrets（如 `actions` 中使用的 API Key）
- **申请步骤**：
  1. 创建仓库并添加协作者（队友、助教）。
  2. 在 Settings → Secrets and variables → Actions 中配置所需密钥。
  3. 配置 GitHub Actions Workflow，执行构建、测试、Docker 推送与部署。
- **注意事项**：
  - 禁止将敏感信息直接提交至仓库。
  - 合理使用工作流缓存，控制 CI 运行时长。

## 8. 环境变量对照表

| 环境变量 | 来源平台 | 用途 |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase | 数据库与认证接口地址 |
| `SUPABASE_ANON_KEY` | Supabase | 匿名访问密钥（前端与服务端共用） |
| `SUPABASE_VOICE_BUCKET` | Supabase | 存放语音文件（voice-notes）的 Bucket 名称 |
| `SUPABASE_EXPORT_BUCKET` | Supabase | 存放行程导出文件（JSON 等）的 Bucket 名称 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | 服务端使用的高权限密钥 |
| `DASHSCOPE_API_KEY` | 阿里云 DashScope | 调用通义千问 API |
| `IFLYTEK_APP_ID` | 科大讯飞 | 语音服务应用 ID |
| `IFLYTEK_API_KEY` | 科大讯飞 | 语音识别密钥 |
| `IFLYTEK_API_SECRET` | 科大讯飞 | 语音识别密钥 |
| `AMAP_WEB_KEY` | 高德开放平台 | 前端地图渲染 Key |
| `AMAP_SERVICE_KEY` | 高德开放平台 | 服务器端 POI/路线请求 Key |

> Next.js 通过 `next.config.mjs` 将上表中的服务器变量映射到 `NEXT_PUBLIC_*` 前缀，方便客户端读取，无需重复配置。

## 9. 申请进度追踪模板

| 平台 | 负责人 | 状态 | 备注 |
| --- | --- | --- | --- |
| 科大讯飞 | 待定 | 未开始 / 申请中 / 已完成 | 备注待补充 |
| 通义千问 DashScope | 待定 | 未开始 / 申请中 / 已完成 | 备注待补充 |
| Supabase | 待定 | 未开始 / 申请中 / 已完成 | 备注待补充 |
| 高德开放平台 | 待定 | 未开始 / 申请中 / 已完成 | 备注待补充 |
| 本地 Docker 环境 | 待定 | 未开始 / 申请中 / 已完成 | 备注待补充 |
| 阿里云 ACR | 待定 | 未开始 / 申请中 / 已完成 | 备注待补充 |
| GitHub Secrets | 待定 | 未开始 / 申请中 / 已完成 | 备注待补充 |

按照本清单逐项准备，可确保系统开发、测试与部署过程中所需的外部服务均已就绪，同时满足课程验收对密钥提供与 Docker 镜像的要求。
