module.exports = {
  apps: [
    {
      name: 'ai-review-smee',
      script: 'smee',
      args: '-u https://smee.io/vTGGdfsvArYP3LyK -t http://localhost:3010/webhooks/github',
      cwd: __dirname,
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 50,
      min_uptime: 5000,
    },
  ],
}
