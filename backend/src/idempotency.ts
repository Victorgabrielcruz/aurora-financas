import {createHash} from 'node:crypto';
import {FastifyRequest} from 'fastify';
import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {db} from './db.js';
import {fail} from './validation.js';
function canonical(value:any):any{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
export async function idempotentWrite(req:FastifyRequest,write:(tx:Prisma.TransactionClient)=>Promise<any>){
 const header=req.headers['x-idempotency-key'];
 if(!header)return db.$transaction(write);
 const id=z.string().uuid().parse(header);
 const fingerprint=createHash('sha256').update(JSON.stringify(canonical({path:req.url,body:req.body}))).digest('hex');
 try{return await db.$transaction(async tx=>{
  const previous=await tx.syncReceipt.findUnique({where:{id}});
  if(previous){
   if(previous.tenantId!==req.tenantId||previous.userId!==req.userId||previous.fingerprint!==fingerprint)fail('Este identificador já foi usado com outra despesa. Revise a pendência.',409);
   return previous.response;
  }
  const response=await write(tx);
  await tx.syncReceipt.create({data:{id,userId:req.userId,tenantId:req.tenantId,fingerprint,response:JSON.parse(JSON.stringify(response))}});
  return response;
 });}catch(error:any){if(['P2002','P2034'].includes(error.code)){const previous=await db.syncReceipt.findUnique({where:{id}});if(previous&&previous.tenantId===req.tenantId&&previous.userId===req.userId&&previous.fingerprint===fingerprint)return previous.response;}throw error;}
}
