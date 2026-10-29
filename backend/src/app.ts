import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {ZodError} from 'zod';
import {authRoutes} from './modules/auth.js';
import {accountRoutes} from './modules/accounts.js';
import {cardRoutes} from './modules/cards.js';
import {investmentRoutes} from './modules/investments.js';
import {dashboardRoutes} from './modules/dashboard.js';
import {demoRoutes} from './modules/demo.js';
import {db} from './db.js';
import {schedulerRoutes} from './scheduler.js';
import {generateRecurring} from './modules/accounts.js';
export async function createApp(){
 const app=Fastify({logger:process.env.NODE_ENV!=='test',bodyLimit:1048576,trustProxy:process.env.VERCEL==='1'});
 await app.register(cookie);await app.register(rateLimit,{max:300,timeWindow:'1 minute'});
 app.addHook('onRequest',async(req,reply)=>{reply.header('X-Content-Type-Options','nosniff').header('Referrer-Policy','same-origin').header('X-Frame-Options','DENY');if(req.url.startsWith('/api/'))reply.header('Cache-Control','no-store');if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host) return reply.code(403).send({error:{message:'Origem da requisição não permitida.'}});}});
 app.setErrorHandler((err:any,req,reply)=>{if(err instanceof ZodError)return reply.code(400).send({error:{message:err.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')}});if(['P2034','P2028','P1008'].includes(err.code))return reply.code(409).send({error:{message:'Houve outra operação simultânea. Atualize os dados e tente novamente.'}});if(err.code==='P2003')return reply.code(409).send({error:{message:'Este registro possui histórico vinculado e não pode ser excluído.'}});if(err.code==='P2002')return reply.code(409).send({error:{message:'Este registro já existe.'}});const code=err.statusCode??500;if(code>=500)req.log.error(err);reply.code(code).send({error:{message:code>=500?'Não foi possível concluir a operação. Tente novamente.':err.message}});});
 await authRoutes(app);await accountRoutes(app);await cardRoutes(app);await investmentRoutes(app);await dashboardRoutes(app);await demoRoutes(app);
 await schedulerRoutes(app,()=>generateRecurring());
 app.get('/api/health',async()=>{await db.$queryRaw`SELECT 1`;return {data:{status:'ok',database:'postgresql'}};});
 const root=fileURLToPath(new URL('../../frontend/dist/',import.meta.url));if(existsSync(root)){await app.register(fastifyStatic,{root});app.setNotFoundHandler((req,reply)=>req.url.startsWith('/api/')?reply.code(404).send({error:{message:'Endpoint não encontrado.'}}):reply.sendFile('index.html'));}
 return app;
}
