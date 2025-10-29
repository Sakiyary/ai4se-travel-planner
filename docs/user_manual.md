# AI 旅行规划师用户手册

本手册面向最终评审与课程助教，帮助快速了解 AI 旅行规划师的主要功能与使用流程。推荐结合 `docs/design.md` 与 `docs/platform_setup.md` 阅读，以便掌握应用架构与外部平台配置。

## 1. 登录与账号准备

1. 打开部署后的应用（默认地址为 `http://localhost:3000` 或部署服务器域名）。
2. 点击右上角的“登录”按钮，跳转到 Supabase 提供的登录页。
3. 使用已在 Supabase 项目中创建的邮箱 / 密码组合登录。
4. 首次登录后会为用户创建默认资料记录，包含昵称、默认币种与同行人数等字段。

> **提示**：若登录失败，请检查 `.env` 中的 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY` 是否配置正确，浏览器控制台将输出 Supabase 的错误信息。

## 2. 主页与计划列表

- 登录成功后进入“我的计划”面板，可看到所有旅行计划列表。
- 每个计划卡片显示目的地、时间范围、预算概览等信息，并提供“查看详情”“删除”等操作。
- 通过右上角入口可以创建新计划或跳转至行程生成器。

## 3. 行程规划流程

1. 在“旅行规划器”页填写出行信息：目的地、日期范围、偏好、预算等。
2. 页面会调用通义千问（DashScope）生成行程草案，结果展示在行程预览组件中。
3. 用户可以修改、确认并保存，系统会将行程与每日活动写入 Supabase。

## 4. 语音笔记与语音记账

- 在计划详情页的“语音笔记与语音记账”卡片内可上传或录制语音。
- 语音会通过科大讯飞 API 转写为文本，并存储在 Supabase Storage。
- 转写文本可一键触发“记录为开销”流程，自动填充金额、分类等字段，确认后写入 `expenses` 表。
- 语音列表支持播放、删除、以及再次生成费用草稿。

## 5. 费用管理

- `app/expenses/page.tsx` 展示当前用户在不同计划下的所有费用条目。
- 页面顶部提供语音记账入口，流程与计划详情页保持一致。
- 列表支持按照金额、分类、备注进行排序与筛选，底部展示简单汇总。

## 6. 行程详情与导出

- 进入 `计划详情` 页可以查看每日行程安排、预算对比、费用概览以及最近记账信息。
- “导出行程”按钮可选择三种格式：
  - **Markdown**：生成可读性良好的行程笔记。
  - **JSON**：完整导出计划结构，便于导入其他系统。
  - **PDF**：使用内置 SimHei 字体直接生成中文 PDF，无需额外下载字体。
- 导出时文件命名规则为 `{计划标题}_{年月日}.{扩展名}`。

## 7. 用户资料页

- 在“个人资料”页面可编辑昵称、默认币种、默认同行人数等偏好。
- 提交后数据直接写入 Supabase `profiles` 表，随后刷新计划生成器会自动引用这些默认值。

## 8. 配置项与环境变量

关键环境变量（详见 `.env.example`）：

| 变量名 | 说明 |
| --- | --- |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公共匿名密钥 |
| `SUPABASE_VOICE_BUCKET` | 存放语音文件的 Storage Bucket 名称 |
| `SUPABASE_EXPORT_BUCKET` | 导出行程的 Storage Bucket 名称 |
| `DASHSCOPE_API_KEY` | 通义千问 API Key |
| `AMAP_WEB_KEY` / `NEXT_PUBLIC_AMAP_KEY` | 高德地图 JS API Key |
| `AMAP_SECURITY_JS_CODE` / `NEXT_PUBLIC_AMAP_SECURITY_JS_CODE` | 高德安全校验码 |
| `IFLYTEK_APP_ID` / `NEXT_PUBLIC_IFLYTEK_APP_ID` | 科大讯飞 App ID |
| `IFLYTEK_API_KEY`、`IFLYTEK_API_SECRET` | 科大讯飞语音识别密钥 |

> **构建与 CI 提示**：GitHub Actions `quality` 任务会填充一组哑数据，保证 `npm run build` 在 CI 环境中可执行。实际部署时需在 `.env` 或容器环境变量中填写真实值。

## 9. Docker 使用指南

1. 在仓库根目录执行 `docker build -t travel-planner:latest .` 构建镜像。
2. 准备 `.env` 或 `.env.local`，填入上文所列的环境变量。
3. 使用 `docker run --env-file .env.local -p 3000:3000 travel-planner:latest` 启动容器，浏览器访问 `http://localhost:3000` 完成验证。
4. 若部署在云服务器，建议配合反向代理及 HTTPS 证书，以便语音录制可用。

## 10. 常见问题排查

| 场景 | 解决方案 |
| --- | --- |
| PDF 导出仍出现乱码 | 确认 `public/fonts/simhei.ttf` 是否存在，或根据 README 指南替换为其它字体并更新 `CHINESE_FONT_CONFIG`。 |
| 无法连接 Supabase | 检查 `.env` 是否写入有效的 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`，浏览器控制台会输出具体错误。 |
| 语音转写失败 | 确认科大讯飞密钥是否过期，或在开发环境允许非 HTTPS 麦克风访问。 |
| 高德地图未渲染 | 确认 `NEXT_PUBLIC_AMAP_KEY` 与 `NEXT_PUBLIC_AMAP_SECURITY_JS_CODE` 已配置，且域名满足白名单。 |
| Docker 容器启动后报错 | 使用 `docker logs` 查看输出，核对环境变量是否齐全，并保证容器能够访问外部 API。 |

## 11. 版本管理与后续迭代建议

- 代码提交遵循 CI 限制，确保在本地通过 lint / typecheck / test 后再推送。
- 若未来增加实时提醒、复杂安全策略等功能，请同步更新 `docs/design.md`、CI 配置以及用户手册。
- 推荐在 GitHub Releases 中上传 GitHub Actions 产出的 `.next` 工件或 Docker 镜像标签，方便课程评分与项目归档。

祝使用愉快！如需进一步协助，请在项目 Issue 中联系开发团队。
