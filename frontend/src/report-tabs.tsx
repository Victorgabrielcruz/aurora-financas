import {NavLink} from 'react-router-dom';
export function ReportTabs(){return <nav className="report-tabs" aria-label="Tipos de relatório"><NavLink end to="/relatorios">Visão geral</NavLink><NavLink to="/relatorios/diario">Relatório diário</NavLink><NavLink to="/relatorios/itens">Gastos por item</NavLink></nav>;}
