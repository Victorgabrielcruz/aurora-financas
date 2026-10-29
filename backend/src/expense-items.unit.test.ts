import {test} from 'node:test';
import assert from 'node:assert/strict';
import {itemReport,validateItems} from './expense-items.js';
import {compositionSchema} from './validation.js';
test('Relatório soma nomes equivalentes, conta compras distintas e mantém valores sem detalhamento',()=>{
 const result=itemReport([{id:'a',amount:10000,items:[{name:' Café ',amount:1000},{name:'CAFÉ',amount:500},{name:'Arroz  integral',amount:2000}]},{id:'b',amount:5000,items:[{name:'cafe',amount:2000},{name:'ARROZ integral',amount:1000}]},{id:'c',amount:2000,items:[]}]);
 assert.equal(result.total,17000);assert.equal(result.detailed,6500);assert.equal(result.undetailed,10500);
 assert.deepEqual(result.items.map(i=>[i.name,i.amount,i.purchases]),[['Café',3500,2],['Arroz integral',3000,2]]);
 assert.equal(result.items[0].percentage,3500/17000*100);
});
test('Composição é opcional, aceita detalhamento parcial e rejeita total excedente',()=>{
 assert.deepEqual(validateItems([],10000),[]);assert.deepEqual(validateItems([{name:'Arroz',amount:3000}],10000),[{name:'Arroz',amount:3000}]);
 assert.throws(()=>validateItems([{name:'Arroz',amount:10001}],10000),/ultrapassar/);
 assert.throws(()=>validateItems([{name:'Arroz',amount:1000}],10000,'INCOME'),/apenas para despesas/);
 for(const items of [[{name:' ',amount:100}],[{name:'Arroz',amount:0}],[{name:'Arroz',amount:1.5}],[{name:'Arroz',amount:-1}],Array.from({length:101},()=>({name:'Arroz',amount:1}))])assert.equal(compositionSchema.safeParse({items}).success,false);
});
test('Relatório vazio não produz percentuais inválidos',()=>{assert.deepEqual(itemReport([]),{total:0,detailed:0,undetailed:0,coverage:0,purchases:0,items:[]});});
