import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AppContext} from '../src/context';
import {TransactionRows} from '../src/components/common';

test('Receita mostra o mês escolhido, a data recebida e a opção de editar',()=>{
 const salary={id:'salary',description:'Salário antecipado',type:'INCOME',date:'2026-10-30',amount:300000,status:'CONFIRMED',referenceMonth:'2026-11'};
 const render=(rows:any[])=>renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><AppContext.Provider value={{hidden:false,user:{tenantId:'tenant'}} as any}><TransactionRows data={rows} editable/></AppContext.Provider></QueryClientProvider>);
 const html=render([salary]);
 assert.match(html,/Mês de referência: novembro de 2026/);
 assert.match(html,/30\/10\/2026/);
 assert.match(html,/aria-label="Editar Salário antecipado"/);
 assert.match(render([{...salary,referenceMonth:null}]),/Mês de referência: outubro de 2026/);
 assert.doesNotMatch(render([{...salary,type:'EXPENSE'}]),/Mês de referência/);
});
