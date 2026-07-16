// PM2 process config — keeps the server alive & restarts on crash/reboot.
//   pm2 start ecosystem.config.js && pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: "vibe-roadmap",
      script: "server.js",
      node_args: "--disable-warning=ExperimentalWarning",
      instances: 1, // in-memory rate limiter assumes a single instance
      exec_mode: "fork",
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        PORT: "3012",
      },
      // .env is still loaded by dotenv inside server.js; secrets live there.
      out_file: "./logs/out.log",
      error_file: "./logs/err.log",
      time: true,
    },
  ],
};
