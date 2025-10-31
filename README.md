# AI 旅行规划师

AI 旅行规划师是一个基于 Next.js 15 的语音驱动旅行策划应用，支持 AI 生成行程、预算管理、语音笔记转费用，并提供 Markdown / JSON / PDF 等多种导出方式。本仓库包含课程交付所需的全部前端代码、容器打包脚本与 CI/CD 配置。

## ✨ 主要特性

- 语音上传 + 科大讯飞转写，秒级得到旅行笔记。
- 行程详情页聚合每日活动、预算统计和费用列表，并支持 Markdown / JSON / PDF 导出。
- 费用页集成语音记账入口，延续语音笔记快速记账流程。
- 用户资料页可编辑昵称、默认币种、同行人数并保存到 Supabase。
- 内置 `SimHei` 字体，在纯前端环境中也能生成正确的中文 PDF。
- 关键 AI 操作自动写入审计日志，可在个人资料页查看最近记录。
- React Query 管理数据缓存、Chakra UI + Tailwind 统一界面风格。

## 🧱 项目结构总览

```text
├─ app/                # Next.js App Router 页面
├─ components/         # UI 组件：行程、地图、费用等
├─ hooks/              # 自定义 Hook（认证、Supabase 等）
├─ lib/                # Supabase 客户端、主题、常量
├─ services/           # LLM、语音、存储封装
├─ public/fonts/       # PDF 导出使用的 SimHei 字体
├─ docs/               # 设计文档、执行计划、平台接入说明
├─ Dockerfile          # 多阶段构建镜像脚本
└─ .github/workflows/  # GitHub Actions CI 工作流
```

更多背景与设计细节可参考 `docs/design.md` 与 `docs/mid_term_plan.md`。

## ⚙️ 环境准备

1. **安装依赖工具**：Node.js 20+、npm 10+、Git、Docker Desktop（可选，用于本地打包镜像）。
1. **配置环境变量**：

    ```bash
    cp .env.example .env
    ```

    按照 `docs/platform_setup.md` 中的对照表填写 DashScope、科大讯飞、高德等密钥。仓库附带的 `.env.example` 已预置演示 Supabase URL、匿名密钥与默认 Bucket 名称，如需接入自有 Supabase 项目，请将这些值替换为实际配置。`.env` 会在开发、CI 以及 Docker / Compose 中统一读取，应用启动后由 `RuntimeConfigScript` 将这些值注入浏览器可读的 `window.__APP_CONFIG__`，因此无需再维护 `NEXT_PUBLIC_*` 变量。

1. **安装依赖**：

    ```bash
    npm ci
    ```

## 🚀 本地开发与调试

- 启动开发服务器：`npm run dev`（默认 <http://localhost:3000>）。
- 代码规范检查：`npm run lint`
- TypeScript 类型检查：`npm run typecheck`
- 生产构建：`npm run build`

### PDF 导出字体说明

`app/plans/[planId]/page.tsx` 在生成 PDF 前会从 `public/fonts/simhei.ttf` 加载 SimHei 字体，以确保导出的 PDF 不会出现中文乱码。该字体来源于 Windows 系统自带字体，如需替换为开源字体，可将 OTF/TTF 文件放置在 `public/fonts` 并在同文件中调整 `CHINESE_FONT_CONFIG`。

## 🧪 GitHub Actions CI

`.github/workflows/ci.yml` 实现了两阶段流水线：

1. **quality**（对 `main` 分支的 push / PR 触发）：

- 安装依赖并缓存 npm 模块。
- 执行 `npm run lint`、`npm run typecheck` 与 `npm run build`。
- 上传 `.next` 与相关配置作为构建工件，方便课程组助教下载审阅。

1. **docker**（仅在 push 到 `main` 时触发）：

- 通过 `docker/build-push-action` 构建多阶段镜像。
- 登录 GitHub Container Registry，并推送镜像到 `ghcr.io/sakiyary/ai4se-travel-planner`，发布 `latest` 与提交 `SHA` 标签。
- 复用 GitHub Actions 缓存加速多平台构建。

GitHub 会自动提供 `GITHUB_TOKEN` 用于推送到 GHCR，无需额外配置 Secrets。其他容器仓库可参考注释，自行调整登录步骤。

## 🐳 Docker 打包与运行

`.dockerignore` 已排除 `.env`（及历史使用的 `.env.local`）等文件，因此镜像构建过程中不会携带本地密钥。使用项目根目录的 `Dockerfile` 可构建生产镜像：

```bash
# 构建镜像
docker build -t travel-planner:latest .

# 本地镜像运行（请确保 .env 中变量齐全）
docker run --env-file .env -p 3000:3000 travel-planner:latest

# 直接使用发布在 GHCR 的镜像
docker run --env-file .env -p 3000:3000 ghcr.io/sakiyary/ai4se-travel-planner:latest
```

镜像特性：

- 多阶段构建（deps → builder → runner），生产阶段仅保留运行所需依赖。
- 构建过程中会运行 lint / typecheck / build，保证产物可用。
- 默认暴露 3000 端口，启动命令为 `npm run start`。
- 启动时读取容器环境变量并通过运行时脚本注入前端，便于在 `docker run` 阶段替换密钥。

### 使用 Docker Compose

```bash
cp .env.example .env          # 先补齐环境变量
docker compose pull           # 确保拉取最新 GHCR 镜像
docker compose up -d          # 后台启动容器
```

Compose 默认读取项目根目录的 `.env` 注入容器。若希望使用其他文件，可执行 `docker compose --env-file your.env up` 或修改 `docker-compose.yml` 的 `env_file` 配置。使用本仓库提供的 `docker-compose.yml` 会自动拉取 `ghcr.io/sakiyary/ai4se-travel-planner:latest` 镜像。

## 📄 文档与交付物

- `docs/design.md`：系统架构、技术选型与业务流程。
- `docs/mid_term_plan.md`：中期执行计划与功能范围。
- `docs/platform_setup.md`：外部平台密钥及部署所需资源清单。
- `docs/development_plan.md` 等：需求拆分与里程碑记录。
- `docs/user_manual.md`：终端用户使用指南。

如需导出操作文档或打包交付，可配合 GitHub Actions 下载自动生成的 `.next` 工件或使用 Docker 镜像快速部署。

## 🙋 支持与反馈

遇到问题可通过 Issue 反馈，或参考 `docs/` 目录中的详细说明。也欢迎根据课程要求扩展更多功能（如实时提醒、复杂安全策略等），相关改动请同步更新文档和 CI 配置。
