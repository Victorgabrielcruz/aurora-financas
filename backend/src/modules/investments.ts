import {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {db} from '../db.js';
import {investmentSchema,money,nonnegative,date,fail} from '../validation.js';
import {investmentSummary,today} from '../finance.js';
import {ownAccount} from './accounts.js';
const include={operations:{orderBy:[{position:'asc' as const}],include:{transaction:{include:{account:true}}}},valuations:{orderBy:[{date:'asc' as const},{createdAt:'asc' as const}]}};
export async function ownInvestment(tenantId:string,id:string,tx:any=db){const i=await tx.investment.findFirst({where:{id,tenantId},include});if(!i)fail('Investimento não encontrado.',404);return i;}
export async function investmentRoutes(app:FastifyInstance){
 app.get('/api/investments',async(req)=>({data:(await db.investment.findMany({where:{tenantId:req.tenantId},include})).map(i=>investmentSummary(i))}));
 app.get('/api/investments/:id',async(req)=>({data:investmentSummary(await ownInvestment(req.tenantId,(req.params as any).id))}));
 app.post('/api/investments',async(req)=>{
  const {initialBalance,referenceDate,...input}=investmentSchema.extend({initialBalance:nonnegative.default(0),referenceDate:date.default(today)}).parse(req.body);
  if(referenceDate>today())fail('O valor inicial não pode ter uma data futura.');
  return {data:await db.investment.create({data:{...input,userId:req.userId,tenantId:req.tenantId,...(initialBalance>0?{operations:{create:{type:'DEPOSIT',amount:initialBalance,costBasis:initialBalance,position:1,date:referenceDate}}}:{})}})};
 });
 app.patch('/api/investments/:id',async(req)=>{const {id}=req.params as any;await ownInvestment(req.tenantId,id);return {data:await db.investment.update({where:{id},data:investmentSchema.partial().parse(req.body)})};});
 app.delete('/api/investments/:id',async(req)=>{
  const {id}=req.params as any;
  return db.$transaction(async tx=>{
   const investment=await ownInvestment(req.tenantId,id,tx);
   const transactionIds=investment.operations.flatMap((o:any)=>o.transactionId?[o.transactionId]:[]);
   await tx.investmentValuation.deleteMany({where:{investmentId:id}});
   await tx.investmentOperation.deleteMany({where:{investmentId:id}});
   await tx.transaction.deleteMany({where:{id:{in:transactionIds},account:{tenantId:req.tenantId}}});
   return {data:await tx.investment.delete({where:{id}})};
  });
 });
 app.post('/api/investments/:id/operations',async(req)=>{const {id}=req.params as any;const input=z.object({type:z.enum(['DEPOSIT','WITHDRAW']),amount:money,accountId:z.string(),date}).parse(req.body);if(input.date>today())fail('Operações futuras não são permitidas.');return db.$transaction(async tx=>{const i=await ownInvestment(req.tenantId,id,tx);if(!i.active)fail('Investimento arquivado.');const lastDates=[...i.operations,...i.valuations].map((x:any)=>x.date);if(lastDates.some((d:string)=>d>input.date))fail('Registre operações em ordem cronológica para preservar o custo e a valorização.');const a=await ownAccount(req.tenantId,input.accountId,tx);if(!a.active||input.date<a.referenceDate)fail('Conta ou data inválida.');const s=investmentSummary(i);if(input.type==='WITHDRAW'&&input.amount>s.current)fail('Resgate maior que o valor atual.');const costBasis=input.type==='DEPOSIT'?input.amount:Math.round(s.invested*input.amount/s.current);const transaction=await tx.transaction.create({data:{accountId:a.id,description:`${input.type==='DEPOSIT'?'Aporte':'Resgate'} • ${i.name}`,type:input.type==='DEPOSIT'?'INVESTMENT_IN':'INVESTMENT_OUT',amount:input.amount,date:input.date}});return {data:await tx.investmentOperation.create({data:{investmentId:id,transactionId:transaction.id,type:input.type,amount:input.amount,costBasis,position:i.operations.length+1,date:input.date}})};});});
 app.post('/api/investments/:id/valuations',async(req)=>{const {id}=req.params as any;const input=z.object({amount:nonnegative,date}).parse(req.body);if(input.date>today())fail('Valorização futura não permitida.');return db.$transaction(async tx=>{const i=await ownInvestment(req.tenantId,id,tx);if([...i.operations,...i.valuations].some((x:any)=>x.date>input.date))fail('Atualize a valorização em ordem cronológica.');return {data:await tx.investmentValuation.create({data:{investmentId:id,operationCount:i.operations.length,createdAt:new Date(Math.max(Date.now(),...i.valuations.map((v:any)=>new Date(v.createdAt).getTime()+1))),...input}})};});});
}
