import './env.js';
import {createApp} from './app.js';
import {db} from './db.js';
import {generateRecurring} from './modules/accounts.js';
const app=await createApp();await db.$connect();
// Vercel instances scale to zero; its authenticated cron owns scheduled work.
let timer:NodeJS.Timeout|undefined;
if(process.env.VERCEL!=='1'&&process.env.RECURRENCE_SCHEDULER!=='external'){
 await generateRecurring();timer=setInterval(()=>generateRecurring().catch(e=>app.log.error(e)),3600000);timer.unref();
}
await app.listen({port:Number(process.env.PORT??3001),host:process.env.HOST??'0.0.0.0'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(timer)clearInterval(timer);await app.close();await db.$disconnect();process.exit(0);});
