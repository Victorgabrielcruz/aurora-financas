import {timingSafeEqual} from 'node:crypto';
import {FastifyInstance} from 'fastify';

export async function schedulerRoutes(app:FastifyInstance,generate:()=>Promise<void>){
  app.get('/api/internal/recurrences',async(req,reply)=>{
    const secret=process.env.CRON_SECRET;
    if(!secret)return reply.code(503).send({error:{message:'Agendamento não configurado.'}});
    const expected=Buffer.from(`Bearer ${secret}`);
    const received=Buffer.from(req.headers.authorization??'');
    if(received.length!==expected.length||!timingSafeEqual(received,expected)){
      return reply.code(401).send({error:{message:'Acesso não autorizado.'}});
    }
    await generate();
    return {data:{status:'ok'}};
  });
}
