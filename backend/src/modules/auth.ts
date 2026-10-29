import {randomBytes,scrypt as scryptCb,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {FastifyInstance,FastifyReply} from 'fastify';
import {z} from 'zod';
import {db} from '../db.js';
import {fail,name} from '../validation.js';

const scrypt=promisify(scryptCb);
const hashToken=(s:string)=>createHash('sha256').update(s).digest('hex');
const sessionLifetime=7*86400000;
const publicUserSelect={id:true,name:true,email:true,theme:true,tenantId:true,tenant:{select:{id:true,name:true}}} as const;
const credentials=z.object({
 email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),
 password:z.string().min(10,'Use pelo menos 10 caracteres.').max(128),
});
const registration=credentials.extend({name,tenantName:name.optional()});
declare module 'fastify' {interface FastifyRequest {userId:string,tenantId:string}}
export const defaults=[['Alimentação','EXPENSE','#e7994a','utensils'],['Supermercado','EXPENSE','#679378','shopping-cart'],['Moradia','EXPENSE','#8a78c5','home'],['Transporte','EXPENSE','#648ec9','car'],['Saúde','EXPENSE','#d17d90','heart'],['Educação','EXPENSE','#7798ae','book'],['Lazer','EXPENSE','#d7af58','coffee'],['Compras','EXPENSE','#c481ba','shopping-bag'],['Assinaturas','EXPENSE','#789e98','repeat'],['Contas e serviços','EXPENSE','#a2a1b9','receipt'],['Salário','INCOME','#2a9b78','briefcase'],['Renda extra','INCOME','#66ad98','sparkles'],['Outros','EXPENSE','#9b9b96','tag']];
function sessionCookie(reply:FastifyReply,token:string){
 reply.setCookie('aurora_session',token,{path:'/',httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:sessionLifetime/1000});
}
export async function authRoutes(app:FastifyInstance){
 app.decorateRequest('userId','');
 app.decorateRequest('tenantId','');
 app.get('/api/auth/status',async()=>({data:{registrationEnabled:true}}));
 app.post('/api/auth/register',{config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async(req,reply)=>{
  const input=registration.parse(req.body);
  const salt=randomBytes(16).toString('hex');
  const key=await scrypt(input.password,salt,64) as Buffer;
  const token=randomBytes(32).toString('hex');
  // Tenant, owner, categories and session either all exist, or none of them do.
  const user=await db.$transaction(async tx=>{
   const tenant=await tx.tenant.create({data:{name:input.tenantName??`Finanças de ${input.name.slice(0,80)}`}});
   const owner=await tx.user.create({data:{name:input.name,email:input.email,tenantId:tenant.id,passwordHash:`${salt}:${key.toString('hex')}`}});
   await tx.category.createMany({data:defaults.map(([name,type,color,icon])=>({name,type,color,icon,userId:owner.id,tenantId:tenant.id}))});
   await tx.session.create({data:{id:hashToken(token),userId:owner.id,expiresAt:new Date(Date.now()+sessionLifetime)}});
   return tx.user.findUniqueOrThrow({where:{id:owner.id},select:publicUserSelect});
  });
  sessionCookie(reply,token);
  return reply.code(201).send({data:user});
 });
 app.post('/api/auth/login',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
  const input=credentials.parse(req.body);
  const user=await db.user.findUnique({where:{email:input.email}});
  const [salt,stored]=(user?.passwordHash??`invalid:${'0'.repeat(128)}`).split(':');
  const key=await scrypt(input.password,salt,64) as Buffer;
  if(!timingSafeEqual(Buffer.from(stored,'hex'),key)||!user)fail('E-mail ou senha incorretos.',401);
  const token=randomBytes(32).toString('hex');
  await db.session.create({data:{id:hashToken(token),userId:user.id,expiresAt:new Date(Date.now()+sessionLifetime)}});
  sessionCookie(reply,token);
  return {data:await db.user.findUniqueOrThrow({where:{id:user.id},select:publicUserSelect})};
 });
 app.post('/api/auth/logout',async(req,reply)=>{
  if(req.cookies.aurora_session)await db.session.deleteMany({where:{id:hashToken(req.cookies.aurora_session)}});
  reply.clearCookie('aurora_session',{path:'/'});
  return {data:true};
 });
 app.addHook('preHandler',async(req)=>{
  if(!req.url.startsWith('/api/')||req.url.startsWith('/api/auth/')||req.routeOptions.url==='/api/health'||req.routeOptions.url==='/api/internal/recurrences')return;
  const token=req.cookies.aurora_session;
  const session=token?await db.session.findUnique({where:{id:hashToken(token)},include:{user:{select:{tenantId:true}}}}):null;
  if(!session||session.expiresAt<=new Date())fail('Entre na sua conta para continuar.',401);
  req.userId=session.userId;
  req.tenantId=session.user.tenantId;
  // A tab belonging to a previous session must never display a different tenant's response.
  if(req.headers['x-aurora-tenant']&&req.headers['x-aurora-tenant']!==req.tenantId)fail('A sessão mudou. Entre novamente para continuar com segurança.',401);
 });
 app.get('/api/me',async(req)=>({data:await db.user.findUniqueOrThrow({where:{id:req.userId},select:publicUserSelect})}));
 app.patch('/api/me',async(req)=>{
  const input=z.object({name:name.optional(),theme:z.enum(['light','dark']).optional()}).parse(req.body);
  return {data:await db.user.update({where:{id:req.userId},data:input,select:publicUserSelect})};
 });
}
