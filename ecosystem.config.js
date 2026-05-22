// PM2 process manager config for Lalela backend + Cloudflare Tunnel.
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup   (follow the printed command to enable auto-start on boot)

module.exports = {
  apps: [
    {
      name: 'lalela-server',
      script: 'npx',
      args: 'tsx server/index.ts',
      cwd: __dirname,
      // Load production env from .env at project root
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      // Restart on crash, but not more than 10 times in 30 s
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 3000,
      // Logging
      out_file: '/tmp/lalela-server.log',
      error_file: '/tmp/lalela-server.err',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'lalela-tunnel',
      script: 'cloudflared',
      args: 'tunnel run 4b361416-2b2f-4865-b5a2-e5a4d003b579',
      // cloudflared reads ~/.cloudflared/config.yml automatically
      max_restarts: 10,
      min_uptime: '15s',
      restart_delay: 5000,
      out_file: '/tmp/lalela-tunnel.log',
      error_file: '/tmp/lalela-tunnel.err',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
