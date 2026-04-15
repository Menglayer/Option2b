# BTC Dual vs Options Compare

Falcon-style light UI 的 BTC 双币理财 vs 期权收益对比工具。

## 架构说明

当前采用 **Vite 工程化静态前端**：

- 运行时依旧是纯前端（无后端）
- 通过 `vite build` 产出 `dist/`，适配 GitHub Pages
- 代码入口：`index.html` + `app.js` + `style.css`

> 后续可继续把 `app.js` 拆分成 `src/` 模块（api/state/render/filters）

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

构建产物在 `dist/`。

## GitHub Pages 自动部署

已内置 workflow：`.github/workflows/deploy-pages.yml`

1. 推送到 `main` 分支
2. GitHub 仓库 `Settings -> Pages` 选择 **GitHub Actions**
3. 自动构建并发布

## 注意

- `vite.config.js` 当前 `base: './'`，适合多数 Pages 场景。
- 若你用项目仓库路径部署并希望绝对路径，可改成 `base: '/<repo-name>/'`。
