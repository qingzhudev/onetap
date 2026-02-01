# OneTap 浏览器插件

OneTap 是一个基于 Plasmo 的浏览器扩展，用于对当前页面域名快速执行预设分析服务，并支持分组管理与一键批量打开。

## 功能概览
- 自动提取当前标签页根域名（移除 www 前缀）
- 点击单个服务在新标签页打开
- 点击分组图标批量打开组内服务（后台打开）
- 分组创建、重命名、删除、拖拽排序
- 服务拖拽排序与跨组移动
- 自动保存配置

## 开发环境

```bash
npm install
npm run dev
```

在浏览器中加载开发构建：`build/chrome-mv3-dev`。

## 构建与打包

```bash
npm run build
npm run package
```

打包产物会生成在 `build/` 目录。

## 质量保障
- `npm run lint` 代码规范检查
- `npm run typecheck` TypeScript 类型检查
- `npm run test` 单元测试
- GitHub Actions CI：安装依赖、Lint、Typecheck、Test、Build
- GitHub Actions CD：标签发布时自动打包并上传产物

## 目录结构
- `src/popup.tsx` 弹出层 UI
- `src/options.tsx` 分组管理页面
- `src/lib/` 业务逻辑与存储工具
- `src/styles/` 样式文件
- `.github/workflows/` CI/CD

## 预设配置
默认提供 5 个分析服务与 3 个分组，可在管理页面自行调整或新增。
