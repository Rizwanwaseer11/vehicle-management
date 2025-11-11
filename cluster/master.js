const cluster = require('cluster');
const os = require('os');

const numCPUs = Math.max(1, os.cpus().length - 1);

if (cluster.isMaster) {
  console.log(`[MASTER] PID ${process.pid} - starting ${numCPUs} workers`);
  for (let i = 0; i < numCPUs; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    console.error(`[MASTER] Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });

  process.on('SIGINT', () => {
    console.log('[MASTER] Shutting down...');
    for (const id in cluster.workers) cluster.workers[id].process.kill('SIGTERM');
    process.exit(0);
  });
} else {
  require('../worker');
}
