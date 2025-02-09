module.exports = {
  apps: [{
    name: 'selfi-bot',
    script: 'dist/index.js',
    exec_mode: 'fork',  // Explicitly set to fork mode
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    env_production: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    // Load .env file
    env_file: '.env',
    // Logging
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    merge_logs: true,
    time: true,
  }]
};