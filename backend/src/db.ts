import './env.js';
import { PrismaClient } from '@prisma/client';
export const db=new PrismaClient({
  // Preserve atomic financial read/modify/write operations under Postgres concurrency.
  transactionOptions:{isolationLevel:'Serializable',maxWait:10000,timeout:30000},
});
