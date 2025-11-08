// change this:
// import { Connection, Client } from 'temporalio';

// to this:
import { Connection, Client } from '@temporalio/client';

export async function getTemporalClient() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  });
  return new Client({ connection, namespace: 'default' });
}
