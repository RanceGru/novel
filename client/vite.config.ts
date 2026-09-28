// Vite 配置 — Electron + React + Tailwind
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { build as esbuild, context as esbuildContext } from 'esbuild';
import path from 'path';

/**
 * 用 esbuild 单独产出 preload.cjs。
 *
 * 为什么不交给 vite-plugin-electron：该插件用 Vite 的 lib 模式构建 Electron 入口，
 * 而 lib 模式允许「同一入口 × 多种 format」，每种 format 都会算出一个 output。
 * 本包 package.json 是 "type": "module"，插件默认 formats: ['es']；一旦我们再去
 * 覆盖 lib.formats 或 rollupOptions.output，就会得到**两个 output 指向同一个
 * preload.cjs 路径**，两个格式并发写同一文件、谁后写谁赢。实测表现为产物在
 * 「干净的 CJS」与「ESM 语法」之间随机交替，且两者字节数完全相同（613B），
 * 只看大小根本发现不了。Electron 加载到 ESM 那份就报
 *   Unable to load preload script … Cannot use import statement outside a module
 * 结果就是渲染进程里 window.electronAPI 一直不存在。
 *
 * 用 esbuild 就不会有这个问题：一次构建、一个 format、一个输出文件。
 *
 * 为什么必须是 CJS：Electron 的 preload 不支持 ESM。实测四种组合，
 * 只有 CJS 可用（sandbox 开关不影响这个结论）：
 *   sandbox=true  + .mjs → 报错
 *   sandbox=false + .mjs → 不报错，但 contextBridge 不生效
 *   sandbox=true  + .cjs → 正常
 *   sandbox=false + .cjs → 正常
 * 产物用 .cjs 扩展名是因为 "type": "module" 会把同目录的 .js 当作 ESM。
 */
function buildPreload(): Plugin {
  const entry = path.resolve(__dirname, 'electron/preload.ts');
  const outfile = path.resolve(__dirname, 'dist-electron/preload.cjs');
  const options = {
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: ['electron'],
    sourcemap: false,
    logLevel: 'warning',
  };

  return {
    name: 'build-preload-cjs',
    // 生产构建：在 Vite 打包前先产出 preload.cjs
    async buildStart() {
      if (this.meta.watchMode) return;   // dev 由下面的 esbuild watch 负责
      await esbuild(options);
    },
    // 开发：起一个 esbuild watch，每次产出后让渲染进程整页重载
    // （preload 只在页面加载时注入，改了 preload 必须重新加载页面才生效）
    async configureServer(server) {
      const ctx = await esbuildContext({
        ...options,
        plugins: [{
          name: 'restart-electron',
          setup(b) {
            b.onEnd((result) => {
              if (result.errors.length) {
                console.error('[preload] 构建失败:', result.errors[0].text);
                return;
              }
              server.ws.send({ type: 'full-reload' });
            });
          },
        }],
      });
      await ctx.watch();
      server.httpServer?.once('close', () => ctx.dispose());
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    buildPreload(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
