import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import App from './App';
import {offlineClient} from './offline';
import './styles.css';
const queryClient=new QueryClient({defaultOptions:{queries:{networkMode:'always',retry:false,staleTime:15000,refetchOnWindowFocus:true},mutations:{networkMode:'always',retry:false}}});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><App/></BrowserRouter></QueryClientProvider></React.StrictMode>);
const refresh=()=>{queryClient.invalidateQueries();void offlineClient.sync();};
window.addEventListener('online',refresh);window.addEventListener('offline',()=>offlineClient.markDisconnected());window.addEventListener('focus',()=>void offlineClient.sync());window.addEventListener('aurora:synced',()=>queryClient.invalidateQueries());
window.addEventListener('aurora:connection-restored',()=>queryClient.invalidateQueries());
setInterval(()=>{void offlineClient.sync();if(!offlineClient.getSnapshot().connected)void queryClient.invalidateQueries({queryKey:['/me']});},30000);
if('BroadcastChannel' in window){const channel=new BroadcastChannel('aurora-offline');window.addEventListener('aurora:outbox-changed',()=>channel.postMessage('changed'));window.addEventListener('aurora:identity-changed',()=>channel.postMessage('identity'));channel.onmessage=event=>{if(event.data==='identity'){offlineClient.forgetMemory();window.dispatchEvent(new Event('aurora:unauthorized'));queryClient.invalidateQueries({queryKey:['/me']});}else{void offlineClient.refreshStatus();queryClient.invalidateQueries();}};}
if(!navigator.onLine)offlineClient.markDisconnected();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{}));
