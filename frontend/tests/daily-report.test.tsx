import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AppContext} from '../src/context';
import {DailyReportContent,DailyReportData} from '../src/daily-report';
import {ReportTabs} from '../src/report-tabs';

function render(element:any,hidden=false){return renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><AppContext.Provider value={{hidden,user:{tenantId:'tenant'}} as any}><MemoryRouter initialEntries={['/relatorios/diario']}>{element}</MemoryRouter></AppContext.Provider></QueryClientProvider>);}
const data:DailyReportData={date:'2026-10-29',income:20000,expense:5000,result:15000,entries:[{id:'purchase',description:'Mercado do dia',type:'CREDIT_CARD',amount:5000,date:'2026-10-29',items:[],category:{name:'Alimentação',color:'#123456',icon:'tag'},account:{name:'Meu cartão'}}]};

test('Relatório diário mostra data, totais, compra no cartão e exportação',()=>{
 const html=render(<DailyReportContent data={data}/>);
 for(const text of ['29/10/2026','200,00','50,00','150,00','Mercado do dia','Cartão ·','Meu cartão','Exportar','não é o saldo'])assert.ok(html.includes(text),text);
 const hidden=render(<DailyReportContent data={data}/>,true);assert.doesNotMatch(hidden,/200,00|50,00|150,00/);assert.match(hidden,/••••••/);
});
test('Relatório diário tem estado vazio e sua própria aba ativa',()=>{
 assert.match(render(<DailyReportContent data={{...data,income:0,expense:0,result:0,entries:[]}}/>),/Nenhuma movimentação neste dia/);
 const html=render(<ReportTabs/>);assert.match(html,/<a[^>]*aria-current="page"[^>]*href="\/relatorios\/diario"[^>]*>Relatório diário<\/a>/);
});
