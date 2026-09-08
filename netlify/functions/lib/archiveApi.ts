import { canAccessArchive,isArchiveDate } from '../../../shared/archive';
import { getQuizDate } from './quizDate';
import { getArchiveContent } from './archiveContent';
export function createArchiveHandler(kind:'catalog'|'quiz',read=getArchiveContent,today=getQuizDate) {
  return async(request:Request)=>{
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Cache-Control':'no-store'};
    const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
    if(request.method==='OPTIONS')return reply({});
    if(request.method!=='GET')return reply({error:'Method not allowed'},405);
    if(!canAccessArchive())return reply({error:'Archive access unavailable'},403);
    const params=new URL(request.url).searchParams;
    const date=params.get('date');const before=params.get('before');const day=today();
    if(kind==='quiz'&&(!date||!isArchiveDate(date,day)))return reply({error:'Choose a past quiz date'},400);
    if(before&&!isArchiveDate(before,day))return reply({error:'Invalid page cursor'},400);
    try{
      const all=await read(day);
      if(kind==='quiz'){
        const quiz=all.find(q=>q.date===date);
        return quiz?reply({quiz}):reply({error:'This quiz is not available'},404);
      }
      const candidates=all.filter(q=>!before||q.date<before);
      const page=candidates.slice(0,20);
      return reply({quizzes:page.map(q=>({date:q.date,id:q.id,contentVersion:q.contentVersion})),nextCursor:candidates.length>20?page.at(-1)!.date:null});
    }catch{return reply({error:'Archive temporarily unavailable. Please retry.'},503);}
  };
}
