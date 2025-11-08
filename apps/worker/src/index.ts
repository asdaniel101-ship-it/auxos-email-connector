import { Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  const worker = await Worker.create({
    taskQueue: 'agent-queue',
    workflowsPath: require.resolve('./workflows'), // bundles workflows
    activities,
  });
  console.log('Worker connected, polling task queue: agent-queue');
  await worker.run();
}
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
