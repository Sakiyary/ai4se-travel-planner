# Supabase 初始化指南

本目录保存数据库架构与种子数据脚本，应全部纳入版本控制。在为项目编写依赖数据库的新功能前，请先完成以下准备。

## 本地环境准备

1. 安装 Supabase CLI（Windows 示例）：

   ```powershell
   iwr -useb https://supabase.io/install/windows | iex
   supabase --version
   ```

2. 浏览器登录（仅需一次）：

   ```powershell
   supabase login
   ```

3. 在仓库根目录初始化 Supabase 元数据：

   ```powershell
   supabase init
   ```

   若未存在，该命令会生成 `supabase/config.toml`。

4. 需要本地 Postgres + Studio 时启动容器栈：

   ```powershell
   supabase start
   ```

5. 本地应用架构与种子数据（会重置数据）：

   ```powershell
   supabase db reset --linked
   ```

   - 按文件名顺序执行 `supabase/sql` 下的 SQL。
   - 随后执行 `supabase/seed/seed.sql`。

6. 完成云端项目创建后，关联并推送变更：

   ```powershell
   supabase link --project-ref <project-ref>
   supabase db push
   ```

## 需要在控制台完成的操作

- 访问 <https://supabase.com/> 创建项目，记录 Project Reference、`SUPABASE_URL`、Service Role Key，已保存在 `.env` 中。
- 在 Supabase Studio → Storage 中创建私有 bucket `voice-notes`，并设置仅限对应用户的 RLS 策略。

## 目录结构

- `sql/001_base_schema.sql`：核心表结构、索引与行级安全策略。
- `seed/seed.sql`：演示用户、行程与费用等测试数据。

如需新增迁移，请另建按序编号的 SQL 文件，例如 `002_budget_views.sql`。
