import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {AppContext} from '../src/context';
import {TransactionRows} from '../src/components/common';
import {InvoiceDetails,CardDetails} from '../src/cards';

const category={name:'Compras',icon:'shopping-cart',color:'#168268'};
const purchase={id:'purchase',description:'Celular',date:'2026-05-10',category,amount:120000};
const invoice={id:'invoice',cardId:'card',card:{name:'Meu cartão'},month:'2026-10',closingDate:'2026-10-25',dueDate:'2026-11-05',status:'CLOSED',total:10000,paid:0,remaining:10000,payments:[],installments:[{id:'part',number:5,amount:10000,purchase}]};
function render(path:string,data:any){
 const queryClient=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
 const endpoint=path.startsWith('/faturas')?'/invoices/invoice':'/cards/card';
 queryClient.setQueryData(['tenant',endpoint],data);
 try{return renderToStaticMarkup(<QueryClientProvider client={queryClient}><AppContext.Provider value={{user:{tenantId:'tenant'},hidden:false} as any}><MemoryRouter initialEntries={[path]}><Routes><Route path="/faturas/:id" element={<InvoiceDetails/>}/><Route path="/cartoes/:id" element={<CardDetails/>}/><Route path="/transacoes" element={<TransactionRows data={data} editable/>}/></Routes></MemoryRouter></AppContext.Provider></QueryClientProvider>);}finally{queryClient.clear();}
}
test('Fatura com resposta antiga sem lista de parcelas continua renderizando',()=>{
 const html=render('/faturas/invoice',invoice);
 assert.match(html,/Fatura de outubro/);assert.match(html,/Celular/);assert.match(html,/Pagar fatura/);assert.match(html,/<td>5<\/td>/);assert.doesNotMatch(html,/NaN|Infinity/);
});
test('Fatura atual mostra parcela e total original de uma compra antiga',()=>{
 const html=render('/faturas/invoice',{...invoice,installments:[{...invoice.installments[0],purchase:{...purchase,installments:[{number:5},{number:6},{number:12}]}}]});
 assert.match(html,/<td>5\/12<\/td>/);assert.match(html,/Saldo em aberto/);
});
test('Fatura paga mostra histórico e não oferece novo pagamento',()=>{
 const html=render('/faturas/invoice',{...invoice,status:'PAID',paid:10000,remaining:0,payments:[{id:'payment',amount:10000,date:'2026-10-29',transaction:{account:{name:'Conta corrente'}}}]});
 assert.match(html,/Conta corrente/);assert.doesNotMatch(html,/Pagar fatura/);
});
test('Cartão com resposta antiga mantém quantidade de parcelas visível',()=>{
 const html=render('/cartoes/card',{id:'card',name:'Meu cartão',institution:'Banco',brand:'Visa',limit:100000,used:10000,closingDay:25,dueDay:5,invoices:[invoice],purchases:[{...purchase,installments:[{number:1,invoiceId:'invoice'},{number:2,invoiceId:'next'}]}]});
 assert.match(html,/2x/);assert.match(html,/Celular/);
});

test('Cartão mostra a conta vinculada e transação identifica compra no cartão',()=>{
 const card=render('/cartoes/card',{id:'card',name:'Meu cartão',institution:'Banco',brand:'Visa',limit:100000,used:10000,closingDay:25,dueDay:5,account:{name:'Conta principal'},invoices:[invoice],purchases:[]});
 assert.match(card,/Conta: Conta principal/);
 const html=render('/transacoes',[{...purchase,type:'CREDIT_CARD',status:'CONFIRMED',cardId:'card',account:{name:'Meu cartão'}}]);
 assert.match(html,/Cartão · Meu cartão/);assert.match(html,/Editar compra no cartão/);assert.match(html,/href="\/cartoes\/card"/);
});
