import {z} from 'zod';
import {today} from './finance.js';

export type UsdQuote={rate:number,date:string,source:string,stale:boolean};
const cache=new Map<string,{quote:UsdQuote|null,expires:number}>();
const pending=new Map<string,Promise<UsdQuote|null>>();
const schema=z.object({base:z.literal('USD'),quote:z.literal('BRL'),rate:z.number().positive().finite(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});

// Shared, bounded cache also deduplicates concurrent portfolio/dashboard requests.
export async function usdQuote(at=today()):Promise<UsdQuote|null>{
 const key=at===today()?'latest':at;
 const old=cache.get(key);
 if(old&&old.expires>Date.now())return old.quote;
 if(pending.has(key))return pending.get(key)!;
 const request=(async()=>{
  try{
   const response=await fetch('https://api.frankfurter.dev/v2/rate/USD/BRL'+(key==='latest'?'':'?date='+at),{signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw new Error('Cotação indisponível');
   const data=schema.parse(await response.json());
   if(data.date>at)throw new Error('Data de cotação inválida');
   const quote={rate:data.rate,date:data.date,source:'Frankfurter',stale:false};
   if(cache.size>=200)cache.delete(cache.keys().next().value!);
   cache.set(key,{quote,expires:Date.now()+(key==='latest'?15*60*1000:24*60*60*1000)});
   return quote;
  }catch{
   const quote=old?.quote?{...old.quote,stale:true}:null;
   if(cache.size>=200)cache.delete(cache.keys().next().value!);
   cache.set(key,{quote,expires:Date.now()+60000});
   return quote;
  }finally{pending.delete(key);}
 })();
 pending.set(key,request);
 return request;
}
