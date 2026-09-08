import type { Config } from '@netlify/functions';
import { getPlayerCatalog } from './lib/playerCatalog';
import { searchPlayers } from '../../shared/playerSearch';
export default async function handler(request: Request) {
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
  const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
  if(request.method==='OPTIONS')return reply({});
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  try {
    const {query}=await request.json();
    if(typeof query!=='string'||query.length>120)return reply({error:'Invalid search'},400);
    if(query.trim().length<2)return reply({players:[]});
    return reply({players:searchPlayers(await getPlayerCatalog(),query)});
  } catch { return reply({error:'Player suggestions unavailable'},503); }
}
export const config:Config={method:['POST','OPTIONS']};
