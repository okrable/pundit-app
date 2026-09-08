import { normalizeCareerAnswer } from './careerAnswer';
export interface PlayerSuggestion { id: string; name: string; birthYear?: string; position?: string; }
export interface SearchPlayer extends PlayerSuggestion { aliases?: string[]; }
// Only editorially reviewed aliases belong here, keyed by stable source ID.
export const APPROVED_PLAYER_ALIASES: Record<string, string[]> = {};
export function searchPlayers(players: SearchPlayer[], query: string): PlayerSuggestion[] {
  const normalized = normalizeCareerAnswer(query);
  if(normalized.length < 2) return [];
  return players.map(player => {
    const names = [player.name,...(player.aliases ?? [])].map(normalizeCareerAnswer);
    const rank = names.some(n=>n===normalized) ? 0 : names.some(n=>n.startsWith(normalized)) ? 1 : names.some(n=>n.split(' ').some(part=>part.startsWith(normalized))) ? 2 : 3;
    return {player,rank};
  }).filter(v=>v.rank<3).sort((a,b)=>a.rank-b.rank || a.player.name.localeCompare(b.player.name,'en') || a.player.id.localeCompare(b.player.id))
    .slice(0,8).map(({player:{aliases,...player}})=>player);
}
