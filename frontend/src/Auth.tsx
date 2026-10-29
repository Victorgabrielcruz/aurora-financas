import {FormEvent,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowUpRight,LoaderCircle,ShieldCheck,Sun,Leaf} from 'lucide-react';
import {Button} from './components/ui/button';
import {request} from './lib';

export function Brand(){return <span className="brand"><span className="brand-mark"><i/><i/><i/></span>aurora<span className="brand-dot">.</span></span>}
export default function Auth(){
 const [mode,setMode]=useState<'login'|'register'>('login');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [values,setValues]=useState({name:'',email:'',password:'',confirmation:''});
 const qc=useQueryClient(),register=mode==='register';
 function switchMode(){setMode(register?'login':'register');setError('');setValues(v=>({...v,password:'',confirmation:''}));}
 async function submit(e:FormEvent){
  e.preventDefault();setError('');
  if(register&&values.password!==values.confirmation){setError('As senhas não coincidem.');return;}
  setBusy(true);
  try{
   const body=register?{name:values.name,email:values.email,password:values.password}:{email:values.email,password:values.password};
   const r=await request(register?'/auth/register':'/auth/login','POST',body);
   await qc.cancelQueries();
   qc.removeQueries({predicate:q=>q.queryKey[0]!=='/me'});
   qc.setQueryData(['/me'],r.data);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="auth-page"><div className="auth-story"><Brand/><div className="auth-copy"><div className="eyebrow">CLAREZA PARA O PRESENTE. LIBERDADE PARA O FUTURO.</div><h1>Seu dinheiro.<br/>Seus planos.<br/><em>Um novo olhar.</em></h1><p>Contas, cartões e investimentos em um só lugar.<br/>Um espaço independente para cada pessoa.</p><div className="auth-pill"><ShieldCheck size={17}/> Somente você acessa suas finanças</div></div><div className="auth-art"><div className="art-circle"/><div className="art-circle"/><Leaf size={96} strokeWidth={1}/></div><span className="auth-copyright">Aurora · Finanças pessoais com propósito</span></div><div className="auth-form-side"><div className="mobile-brand"><Brand/></div><div className="auth-form"><span className="welcome-icon"><Sun size={28}/></span><h2>{register?'Crie seu espaço.':'Que bom ter você aqui.'}</h2><p>{register?'Cadastre-se para organizar suas finanças em um espaço só seu.':'Entre com seu e-mail e senha para continuar.'}</p><div className="auth-mode-tabs" role="group" aria-label="Acesso"><button type="button" aria-pressed={!register} className={!register?'selected':''} disabled={busy} onClick={()=>{if(register)switchMode();}}>Entrar</button><button type="button" aria-pressed={register} className={register?'selected':''} disabled={busy} onClick={()=>{if(!register)switchMode();}}>Criar conta</button></div><form onSubmit={submit}>
 {register&&<label className="field"><span>Seu nome</span><input required autoComplete="name" value={values.name} onChange={e=>setValues(v=>({...v,name:e.target.value}))} placeholder="Como podemos te chamar?" maxLength={120} disabled={busy}/></label>}
 <label className="field"><span>E-mail</span><input type="email" required autoComplete="email" value={values.email} onChange={e=>setValues(v=>({...v,email:e.target.value}))} placeholder="voce@exemplo.com" maxLength={254} disabled={busy}/></label>
 <label className="field"><span>Senha</span><input key={mode} type="password" minLength={10} maxLength={128} required autoComplete={register?'new-password':'current-password'} value={values.password} onChange={e=>setValues(v=>({...v,password:e.target.value}))} placeholder={register?'Pelo menos 10 caracteres':'Sua senha'} disabled={busy}/></label>
 {register&&<label className="field"><span>Confirmar senha</span><input type="password" minLength={10} maxLength={128} required autoComplete="new-password" value={values.confirmation} onChange={e=>setValues(v=>({...v,confirmation:e.target.value}))} placeholder="Repita sua senha" disabled={busy}/></label>}
 {error&&<p className="form-error" role="alert">{error}</p>}<Button className="w-full" disabled={busy}>{busy?<LoaderCircle size={18} className="spin"/>:null}{busy?'Aguarde…':register?'Criar minha conta':'Entrar na Aurora'}<ArrowUpRight size={18}/></Button></form><p className="auth-switch">{register?'Já tem uma conta?':'Ainda não tem uma conta?'} <button type="button" onClick={switchMode} disabled={busy}>{register?'Entrar':'Cadastre-se'}</button></p><p className="auth-note"><ShieldCheck size={15}/> Seus dados ficam separados dos outros usuários.<br/>Senha protegida e armazenamento no servidor.</p></div></div></div>;
}
