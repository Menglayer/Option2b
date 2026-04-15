import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages project repo 部署时可改为 '/<repo-name>/'
  // 用户站点 (username.github.io) 可保持 '/'
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
