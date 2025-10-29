# 远程 Supabase 数据库初始化指南

## 适用场景

当部署好的 Next.js 应用需要与云端 Supabase 数据库同步最新的表结构、行级安全策略（RLS）与种子数据时，可按照本文档完成一次标准的远程初始化流程。该流程适用于首次创建云端数据库，或后续需要重新推送迁移脚本的情况。

## 必备前提

- **项目元信息**：`Project Reference`（本项目为 `jfsmutcdmogsrqtlancn`）、`SUPABASE_URL`。
- **高权限密钥**：`Service Role Key`（仅在本地 CLI 使用，禁止暴露在前端）。
- **数据库密码**：Supabase 控制台 → `Project Settings` → `Database` → `Connection info` → `Password`。
- **个人访问令牌（PAT）**：Supabase 控制台右上角头像 → `Access Tokens` → `Create new token`。
- **运行环境**：已安装 [Supabase CLI](https://supabase.com/docs/guides/cli)（建议 v1.194.2 及以上），并在仓库根目录执行命令。

> ⚠️ **安全提示**：Service Role Key 与数据库密码拥有写入权限。务必仅在受信任环境保存，并避免提交到版本控制。

## 一次性环境配置

1. **安装 CLI（Windows PowerShell 示例）**

   ```powershell
   iwr -useb https://supabase.io/install/windows | iex
   supabase --version
   ```

2. **准备访问令牌**（推荐写入当前会话环境变量，避免硬编码）

   ```powershell
   $env:SUPABASE_ACCESS_TOKEN = "<your-personal-access-token>"
   ```

   如需长期保存，可使用 `setx SUPABASE_ACCESS_TOKEN "<token>"` 并重新打开终端。

## 关联远端项目

在仓库根目录执行以下命令，将 CLI 与远端项目绑定：

```powershell
supabase link --project-ref jfsmutcdmogsrqtlancn
```

- CLI 会读取 `SUPABASE_ACCESS_TOKEN` 完成身份验证。
- 链接成功后，项目元数据会写入 `supabase/.temp/`。

若出现访问受限：

- 检查 PAT 是否具备数据库权限。
- 确认 Project Reference 是否填写正确。

## 推送数据库架构

本仓库目前包含一个迁移文件 `supabase/sql/001_base_schema.sql`，该脚本会创建 `profiles`、`plans`、`plan_segments`、`expenses`、`voice_notes`、`audit_logs` 等表及其索引、RLS 策略，与前端 `lib/supabaseQueries.ts`、`components/expenses/*`、`services/speech.ts` 等模块的字段使用保持一致。除非有新的迁移文件加入，执行本节命令即会运行该脚本。

1. **执行迁移脚本**

   ```powershell
   supabase db push --password "<database-password>"
   ```

   - 命令会按文件名顺序运行 `supabase/sql/*.sql`。
   - 若需加载种子数据，可追加 `--seed` 以执行 `supabase/seed/seed.sql`。

2. **常用可选参数**

   - `--dry-run`：仅预览将要执行的 SQL。
   - `--db-schema public`：限定同步的 schema。

> 如果不希望在命令中写入明文密码，可预先执行 `setx SUPABASE_DB_PASSWORD "<database-password>"`（或在当前会话设置 `$env:SUPABASE_DB_PASSWORD`），CLI 会自动读取。

### 手动执行单个 SQL 文件（可选）

如果需要绕过 CLI 直接运行 `001_base_schema.sql`，可使用 Supabase 提供的数据库连接串：

```powershell
psql "postgresql://postgres:<database-password>@db.jfsmutcdmogsrqtlancn.supabase.co:5432/postgres" -f supabase/sql/001_base_schema.sql
```

- 首次使用 `psql` 时，可通过 `supabase db remote commit --dry-run` 获取完整连接信息。
- 若执行后提示对象已存在，表示之前已经创建，可忽略对应告警。

## 验证结果

- **CLI 验证**

  ```powershell
  supabase db diff --linked
  ```

  未生成差异表示远端结构已与本地脚本一致。

- **Supabase Studio**

  在控制台 `Table Editor` 中确认 `profiles`、`plans`、`plan_segments`、`expenses`、`voice_notes`、`audit_logs` 等表及对应 RLS 策略是否存在。

- **应用端验证**

  登录应用执行“保存到我的计划”等操作，确保不再出现 `PGRST2xx` 错误。

## 常见问题与排查

- **`PGRST205` / 缓存未刷新**：运行 `supabase db push` 后等待 1-2 分钟，或在 Supabase Studio → `API` → `Regenerate types` 手动刷新缓存。
- **`supabase link` 卡住**：确认终端未在等待交互；必要时关闭后重新运行命令。
- **缺少 Docker**：远端初始化不依赖 `supabase start`，无需本地 Docker 环境。
- **凭证泄露**：一旦 Service Role Key 或数据库密码泄露，请立即在控制台重置，并更新 `.env`。

## 后续维护建议

- 修改 `supabase/sql/` 或 `supabase/seed/` 后，先执行 `supabase db diff --local` 自检再推送。
- 在 CI/CD 中可通过 GitHub Actions 安装 CLI，注入 PAT 与数据库密码后自动执行 `supabase db push`。
- 定期使用 Supabase 的 `Scheduled backups` 或 `pg_dump` 备份数据，降低数据丢失风险。
