import {test} from 'node:test';
import assert from 'node:assert/strict';
import {QueryClient,QueryObserver} from '@tanstack/react-query';
import {refreshAppData} from '../src/refresh';
test('Salvar não aguarda consultas lentas; eventos repetidos geram uma atualização sem consultar a sessão',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});let reads=0,authReads=0,release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 client.setQueryData(['tenant','/accounts'],{balance:100});client.setQueryData(['/me'],{id:'user'});
 const financial=new QueryObserver(client,{queryKey:['tenant','/accounts'],queryFn:async()=>{reads++;await gate;return {balance:90};}});
 const auth=new QueryObserver(client,{queryKey:['/me'],queryFn:async()=>{authReads++;return {id:'user'};}});
 const stop=financial.subscribe(()=>{}),stopAuth=auth.subscribe(()=>{});
 try{
  assert.equal(refreshAppData(client),undefined);refreshAppData(client);refreshAppData(client);
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(reads,1);assert.equal(authReads,0);assert.equal(financial.getCurrentResult().isFetching,true);assert.deepEqual(financial.getCurrentResult().data,{balance:100});
  release();await new Promise(resolve=>setTimeout(resolve,10));assert.deepEqual(financial.getCurrentResult().data,{balance:90});
 }finally{release();stop();stopAuth();client.clear();}
});
