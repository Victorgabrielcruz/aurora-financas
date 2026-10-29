import {createContext,useContext,ReactNode,useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {request,today} from './lib';
export type User={id:string,name:string,email:string,theme:string,tenantId:string,tenant:{id:string,name:string}};
type Context={user:User,month:string,setMonth:(s:string)=>void,notify:(s:string,error?:boolean)=>void,openForm:(kind:string,data?:any)=>void,confirm:(title:string,action:()=>Promise<any>)=>void,hidden:boolean,setHidden:(v:boolean)=>void};
export const AppContext=createContext<Context>(null!);
export const useApp=()=>useContext(AppContext);
export function useData(path:string){const app=useContext(AppContext);const tenantId=app?.user.tenantId;return useQuery({queryKey:tenantId?[tenantId,path]:[path],queryFn:()=>request(path,'GET',undefined,tenantId).then(r=>r.data)});}
export function useAction(){const q=useQueryClient();const {notify,user}=useApp();return useMutation({mutationFn:({path,method='POST',body}:{path:string,method?:string,body?:any})=>request(path,method,body,user.tenantId),onSuccess:()=>{q.invalidateQueries();notify('Alteração salva com sucesso.');},onError:(e:Error)=>notify(e.message,true)});}
export function DataState({query,children}:{query:any,children:(data:any)=>ReactNode}){if(query.isPending)return <div className="loading-grid" aria-label="Carregando"><div className="skeleton h-36"/><div className="skeleton h-36"/><div className="skeleton h-64"/></div>;if(query.isError)return <div className="empty"><strong>Não foi possível carregar os dados</strong><p>{query.error.message}</p><button className="btn btn-outline" onClick={()=>query.refetch()}>Tentar novamente</button></div>;return children(query.data);}
export const initialMonth=today().slice(0,7);
