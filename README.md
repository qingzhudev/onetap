# OneTap 浏览器插件

OneTap 是一个基于 Plasmo 的浏览器扩展，用于对当前页面域名或选中文本快速执行预设分析服务，并支持分组管理与一键批量打开。

## 功能概览
- ✅ **域名分析**：自动提取当前标签页域名（去除 www.）
- ✅ **文本搜索**：选中文本后直接触发服务
- ✅ **模式切换**：自动识别域名/文本模式并支持手动切换
- ✅ **重复操作**：一键重放上次服务或分组
- ✅ **配置管理**：支持 JSON 与配置码导入/导出
- ✅ **分组管理**：分组创建、重命名、删除、拖拽排序
- ✅ **批量打开**：一键打开组内服务（后台打开）

详细功能说明请查看 `README_FEATURES.md`。

## 变量支持

服务 URL 模板可使用以下变量：

- `{domain}` - 当前网站域名（自动去除 www.）
- `{text}` - 用户在页面上选中的文本

示例：
- Google Search: `https://google.com/search?q={text}`
- Site Search: `https://google.com/search?q=site:{domain}+{text}`
- Whois: `https://whois.domaintools.com/{domain}`

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
- `src/sidepanel.tsx` 侧边栏 UI
- `src/options.tsx` 分组管理页面
- `src/lib/` 业务逻辑与存储工具
- `src/styles/` 样式文件
- `.github/workflows/` CI/CD

## 预设配置
默认提供 5 个分析服务与 3 个分组，可在管理页面自行调整或新增。
