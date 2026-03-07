module.exports = {
  apps: [
    {
      name: 'vm-api-1',
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '700M',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        RUN_SCHEDULER_IN_API: 'false'
      }
    },
    {
      name: 'vm-api-2',
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '700M',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
        RUN_SCHEDULER_IN_API: 'false'
      }
    },
    {
      name: 'vm-scheduler',
      script: 'schedulerWorker.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      merge_logs: true,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
