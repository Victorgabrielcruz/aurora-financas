import {test} from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {schedulerRoutes} from './scheduler.js';

test('Cron exige segredo e nunca executa recorrências sem autenticação',async()=>{
 const previous=process.env.CRON_SECRET;
 const app=Fastify();let calls=0;
 await schedulerRoutes(app,async()=>{calls++;});
 try{
  delete process.env.CRON_SECRET;
  assert.equal((await app.inject({url:'/api/internal/recurrences'})).statusCode,503);
  process.env.CRON_SECRET='secret-used-only-in-tests';
  for(const authorization of [undefined,'Bearer invalid','Bearer '+process.env.CRON_SECRET+'x']){
   assert.equal((await app.inject({url:'/api/internal/recurrences',headers:authorization?{authorization}:{}})).statusCode,401);
  }
  assert.equal(calls,0);
  const result=await app.inject({url:'/api/internal/recurrences',headers:{authorization:`Bearer ${process.env.CRON_SECRET}`}});
  assert.equal(result.statusCode,200);assert.equal(calls,1);
 }finally{
  await app.close();
  if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous;
 }
});
