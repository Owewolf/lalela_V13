// PM2 process manager config for the Lalela backend.
//
// Cloudflare Tunnel is intentionally NOT managed here — it is run as a
// systemd unit (`systemctl status cloudflared`). Defining it in two
// supervisors would have both fight over the same tunnel UUID.
//
// Usage (idempotent — safe to re-run on every deploy):
//   pm2 startOrReload ecosystem.config.js --update-env
//   pm2 save
//   pm2 startup     # once, then follow the printed command to enable boot start
//
// Inspect:
//   pm2 status
//   pm2 logs lalela-server
//   pm2 monit

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'lalela-server',

      // Run tsx directly from the project's node_modules. Avoids the
      // `npx` shim (which forks an extra Node process and slows boot).
      script: path.join(__dirname, 'node_modules', '.bin', 'tsx'),
      args: 'server/index.ts',
      cwd: __dirname,
      interpreter: 'none', // tsx is its own executable, not a JS file

      // Socket.IO holds in-memory room state, so the server MUST run as a
      // single instance. Do not switch to 'cluster' without also wiring up
      // a Socket.IO adapter (Redis, Postgres, etc.).
      exec_mode: 'fork',
      instances: 1,

      // The server calls `import 'dotenv/config'` itself, so .env at the
      // project root is loaded automatically. Anything declared here
      // overrides values from .env.
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },

      // Crash-loop guard: refuse to restart more than 10 times within
      // 30 s. Anything tighter than that is treated as a permanent failure.
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 200,

      // Hard ceiling on memory; pm2 restarts the process if exceeded.
      max_memory_restart: '768M',

      // Graceful shutdown: send SIGINT, give the server 10 s to drain
      // sockets before SIGKILL.
      kill_timeout: 10_000,

      // Logging — persistent under ./logs (gitignored) with rotation
      // handled by pm2-logrotate (install with: pm2 install pm2-logrotate).
      out_file: path.join(__dirname, 'logs', 'lalela-server.out.log'),
      error_file: path.join(__dirname, 'logs', 'lalela-server.err.log'),
      merge_logs: true,
      time: true, // prefix every line with an ISO timestamp
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',

      // pm2 will write the pid file here for external monitors.
      pid_file: path.join(__dirname, 'logs', 'lalela-server.pid'),
    },
  ],
};
