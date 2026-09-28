# Winget 图形管理器

基于 **Electron + React + shadcn/ui** 的 Windows 包管理器（[winget](https://learn.microsoft.com/windows/package-manager/winget/)）图形化前端。

## 功能

| 视图 | 能力 |
| --- | --- |
| 🔍 发现 | 搜索 winget / msstore 源，热门关键词快捷入口，一键安装，已安装标记 |
| 💽 已安装 | 本机程序扫描、本地即时过滤、仅看可更新、单件升级 / 卸载（带确认） |
| ⬆️ 更新 | 可更新列表、单个升级、全部更新（顺序批量）、进度汇总条 |
| 📋 任务中心 | 右下角浮层：安装/升级/卸载实时进度条 + 日志流，可取消、可回看 |
| 📄 详情 | 包版本 / 发布者 / 描述 / 许可证 / 主页链接（系统浏览器打开） |

交互细节：搜索防抖、表格点表头排序、骨架屏、空状态、Toast 通知、暗色模式（含原生窗口背景同步）、外部链接安全打开。

## 开发

```sh
npm install       # 安装依赖
npm run dev       # Vite + Electron 热更新开发
npm run build     # 构建渲染进程到 dist/
npm start         # 以生产模式加载 dist/ 启动
npm run typecheck # TS 类型检查
npm run smoke     # 3 秒自动退出的启动冒烟测试
```

## 架构

```
electron/            主进程（CommonJS）
├── main.js          窗口生命周期、IPC handlers、任务管理、外链拦截
├── preload.js       contextBridge 白名单 API（沙箱 + 上下文隔离）
└── winget.js        winget 执行器：spawn + 流式行输出、固定宽度表格解析
                     （按显示宽度对齐，CJK 双宽）、show 键值解析、进度 % 提取
src/                 渲染进程（Vite + React 19 + TS）
├── App.tsx          视图编排、数据加载、批量更新
├── hooks/           任务中心（IPC 事件订阅 → Promise 化）、主题、防抖
├── components/      视图组件 + shadcn/ui 组件（Tailwind v4）
└── types.ts         主/渲染进程共享类型
```

### winget 输出解析要点（实测 winget v1.29）

- 管道输出为 **UTF-8**；`search/list/upgrade` 为固定列宽表格，列按**显示宽度**对齐（汉字占 2 列），故按表头列起始的显示宽度坐标切片
- `> 1.8.10` 版本前缀表示"版本未知但大于该值"
- `upgrade` 无可用更新时退出码非 0 且输出为空（正常情况）
- 进度行形如 `  45% | …`，以 `\r` 刷新，解析 `(\d+)%`
- `show` 需要 `-e`（exact）避免多源歧义

## 安全

- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`
- preload 仅暴露白名单 IPC API
- CSP meta；`target=_blank` 一律经 `setWindowOpenHandler` 用系统浏览器打开
