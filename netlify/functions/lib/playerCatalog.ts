import { getBigQueryClient, getBigQueryConfig, getBigQueryLocation } from './questionSource';
import { APPROVED_PLAYER_ALIASES, type SearchPlayer } from '../../../shared/playerSearch';
let cached: { expires: number; value: Promise<SearchPlayer[]> } | null = null;
export async function getPlayerCatalog(): Promise<SearchPlayer[]> {
  if(cached && cached.expires > Date.now()) return cached.value;
  const {projectId,dataset} = getBigQueryConfig();
  const value = getBigQueryClient().query({query:
    `SELECT player_id,player_name,date_of_birth,position FROM \`${projectId}.${dataset}.player_dic\``,
    maximumBytesBilled:'100000000',location:getBigQueryLocation()}).then(([rows])=>rows
      .filter((r:any)=>typeof r.player_id === 'string' && typeof r.player_name === 'string' && r.player_name.trim())
      .map((r:any)=>({id:r.player_id,name:r.player_name.trim(),
        birthYear: /\b(18|19|20)\d{2}\b/.exec(String(r.date_of_birth))?.[0],
        position:typeof r.position === 'string' && r.position.length<80 ? r.position : undefined,
        aliases:APPROVED_PLAYER_ALIASES[r.player_id] ?? [] })))
    .catch(error=>{cached=null;throw error;});
  cached={expires:Date.now()+15*60*1000,value};
  return value;
}
