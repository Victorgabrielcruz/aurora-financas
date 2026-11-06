import {test} from 'node:test';
import assert from 'node:assert/strict';
import {usdQuote} from './exchange.js';
import {investmentSummary} from './finance.js';

test('API valida respostas, reutiliza consultas e mantém indisponibilidade explícita',async()=>{
 const original=globalThis.fetch,originalNow=Date.now;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({base:'USD',quote:'BRL',date:'2020-01-02',rate:5.25}));};
  const quotes=await Promise.all([usdQuote('2020-01-02'),usdQuote('2020-01-02')]);
  assert.equal(calls,1);assert.equal(quotes[0]?.rate,5.25);
  await usdQuote('2020-01-02');assert.equal(calls,1);
  globalThis.fetch=async()=>new Response(JSON.stringify({base:'USD',quote:'BRL',date:'2020-01-03',rate:-2}));
  assert.equal(await usdQuote('2020-01-03'),null);
  globalThis.fetch=async()=>{throw new Error('offline');};
  assert.equal(await usdQuote('2020-01-04'),null);
  Date.now=()=>originalNow()+25*60*60*1000;
  const stale=await usdQuote('2020-01-02');
  assert.equal(stale?.rate,5.25);assert.equal(stale?.stale,true);
  const investment={class:'Dólar',operations:[{type:'DEPOSIT',quantity:10,amount:5000,costBasis:5000,date:'2020-01-01'}],valuations:[]};
  const unavailable=investmentSummary(investment,'2020-01-02',null);
  assert.equal(unavailable.current,5000);assert.equal(unavailable.profit,null);assert.equal(unavailable.quoteUnavailable,true);
  const loss=investmentSummary(investment,'2020-01-02',{rate:4,date:'2020-01-02',source:'Teste',stale:false});
  assert.equal(loss.current,4000);assert.equal(loss.profit,-1000);assert.equal(loss.returnPct,-20);
  assert.equal(investmentSummary(investment,'2019-12-31',quotes[0]).quantity,0);
 }finally{globalThis.fetch=original;Date.now=originalNow;}
});
