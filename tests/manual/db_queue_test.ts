
import { DatabaseWriteQueue } from '../../src/storage/databaseWriteQueue';

// Mock DB
const mockDb = {
  transaction: (fn: () => void) => {
    return () => {
      console.log('START TRANSACTION');
      fn();
      console.log('COMMIT TRANSACTION');
    };
  },
  prepare: (sql: string) => {
    return {
      run: (...args: any[]) => {
         // silent execution to avoid spamming 1000 lines
         // console.log(`EXECUTE: ${sql.substring(0, 30)}... [Params: ${args.length}]`)
      },
      free: () => {}
    };
  }
};

async function testQueue() {
  console.log('Initializing Queue...');
  // @ts-ignore
  const queue = DatabaseWriteQueue.getInstance(mockDb);

  console.log('Queueing 1500 items...');
  for (let i = 0; i < 1500; i++) {
    queue.queue({
      type: 'blob',
      data: { blobSha: `sha-${i}`, content: 'content', size: 7 }
    });
  }

  // Should have triggered auto-flush at 1000
  console.log('Waiting for flush processing...');
  // The flush is async but not awaited in queue(), so we wait a bit
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const stats = queue.getStats();
  console.log('Queue stats:', stats);

  console.log('Manually flushing remainder...');
  await queue.flushAll();
  
  console.log('Done.');
}

testQueue().catch(console.error);
