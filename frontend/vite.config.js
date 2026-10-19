import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import http from 'http'

// Fast probe to check if a local port is accepting HTTP connections
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request(
      { host: '127.0.0.1', port: Number(port), path: '/', method: 'GET', timeout: 300 },
      () => resolve(true)
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

let activePort = 8000;

async function detectActivePort(preferred) {
  if (preferred && (await checkPort(preferred))) {
    activePort = preferred;
    return preferred;
  }
  // Standard FastAPI default is 8000, secondary fallback is 8001
  if (await checkPort(8000)) {
    activePort = 8000;
    return 8000;
  }
  if (await checkPort(8001)) {
    activePort = 8001;
    return 8001;
  }
  return preferred || 8000;
}

// Background auto-refresh of active backend port every 2 seconds
setInterval(() => {
  checkPort(8000).then((is8000) => {
    if (is8000) {
      activePort = 8000;
    } else {
      checkPort(8001).then((is8001) => {
        if (is8001) activePort = 8001;
      });
    }
  });
}, 2000);

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const envPort = env.VITE_BACKEND_PORT || env.BACKEND_PORT ? Number(env.VITE_BACKEND_PORT || env.BACKEND_PORT) : null;
  const initialPort = await detectActivePort(envPort);
  console.log(`[Vite Proxy] Active target -> http://127.0.0.1:${initialPort}`);

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${initialPort}`,
          changeOrigin: true,
          router: () => `http://127.0.0.1:${activePort}`,
          configure: (proxy) => {
            proxy.on('error', (err, req, res) => {
              detectActivePort(envPort);
              if (res && res.writeHead && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    error: 'FastAPI backend connection refused',
                    detail: `Could not connect to backend on 127.0.0.1:${activePort}. Ensure uvicorn is running.`,
                    code: err.code || 'ECONNREFUSED'
                  })
                );
              }
            });
          }
        }
      }
    }
  };
});
