import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AppContext} from '../src/context';
import {DailyReportContent,DailyReportData} from '../src/daily-report';
import {ReportTabs} from '../src/report-tabs';
import Dashboard from '../src/dashboard';

function render(element:any,hidden=false){return renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><AppContext.Provider value={{hidden,user:{tenantId:'tenant'}} as any}><MemoryRouter initialEntries={['/relatorios/diario']}>{element}</MemoryRouter></AppContext.Provider></QueryClientProvider>);}
const data:DailyReportData={date:'2026-10-29',income:20000,expense:5000,result:15000,openingBalance:100000,closingBalance:120000,cashChange:20000,cashExpense:0,cardExpense:5000,entries:[{id:'purchase',description:'Mercado do dia',type:'CREDIT_CARD',amount:5000,date:'2026-10-29',items:[],category:{name:'Alimentação',color:'#123456',icon:'tag'},account:{name:'Meu cartão'}}]};

test('Relatório diário mostra data, totais, compra no cartão e exportação',()=>{
 const html=render(<DailyReportContent data={data}/>);
 for(const text of ['29/10/2026','200,00','50,00','150,00','Mercado do dia','Cartão ·','Meu cartão','Exportar','não é o saldo','Saldo ao final do dia','Saldo inicial','1.200,00','1.000,00','Variação nas contas'])assert.ok(html.includes(text),text);
 const hidden=render(<DailyReportContent data={data}/>,true);assert.doesNotMatch(hidden,/200,00|50,00|150,00|1.000,00|1.200,00/);assert.match(hidden,/••••••/);
});
test('Relatório diário tem estado vazio e sua própria aba ativa',()=>{
 assert.match(render(<DailyReportContent data={{...data,income:0,expense:0,result:0,entries:[]}}/>),/Nenhuma movimentação neste dia/);
 const html=render(<ReportTabs/>);assert.match(html,/<a[^>]*aria-current="page"[^>]*href="\/relatorios\/diario"[^>]*>Relatório diário<\/a>/);
});

test('Painel mantém resumo de hoje ao consultar outro mês e oculta seus valores',()=>{
 const client=new QueryClient();
 client.setQueryData(['tenant','/dashboard?month=2026-11'],{
  available:120000,wealth:115000,income:0,expense:2500,result:-2500,
  invested:0,current:0,owed:5000,daily:data,demo:false,
  evolution:[],expensesByCategory:[],distribution:[],recent:[],accounts:[],invoices:[],
 });
 function dashboard(hidden:boolean){return renderToStaticMarkup(<QueryClientProvider client={client}><AppContext.Provider value={{month:'2026-11',hidden,user:{tenantId:'tenant',name:'Teste'}} as any}><MemoryRouter><Dashboard/></MemoryRouter></AppContext.Provider></QueryClientProvider>);}
 const html=dashboard(false);
 for(const text of ['Visão geral do dia','29/10/2026','independente do mês selecionado','Total gasto no dia','Resultado do dia','Saldo ao final do dia','50,00','150,00','Escolher outro dia','parcelas das faturas deste mês'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(dashboard(true),/50,00|150,00|1.200,00/);
 client.clear();
});
