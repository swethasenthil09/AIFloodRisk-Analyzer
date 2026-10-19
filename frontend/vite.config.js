import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import http from 'http'

// Reliable probe to check if a local port is accepting HTTP connections
function checkPort(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.request(
      { host: '127.0.0.1', port: Number(port), path: '/', method: 'GET', timeout: timeoutMs },
      (res) => {
        res.resume();
        resolve(true);
      }
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
  if (preferred && (await checkPort(preferred, 1000))) {
    activePort = preferred;
    return preferred;
  }
  // Standard FastAPI default is 8000, secondary fallback is 8001
  if (await checkPort(8000, 1000)) {
    activePort = 8000;
    return 8000;
  }
  if (await checkPort(8001, 1000)) {
    activePort = 8001;
    return 8001;
  }
  activePort = preferred || 8000;
  return activePort;
}

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
            proxy.on('error', async (err, req, res) => {
              // Attempt to recover if the backend switched or came up on 8000/8001
              await detectActivePort(envPort);
              if (res && res.writeHead && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    error: 'FastAPI backend connection refused',
                    detail: `Could not connect to backend on 127.0.0.1:${activePort}. Ensure uvicorn is running on port 8000.`,
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
