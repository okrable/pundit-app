export const SYMBOL_AVATAR_DEFINITIONS = [
  { id: 'symbol-classic-leather-football', type: 'symbol', label: 'Classic leather football' },
  { id: 'symbol-modern-panelled-football', type: 'symbol', label: 'Modern panelled football' },
  { id: 'symbol-football-boot', type: 'symbol', label: 'Football boot' },
  { id: 'symbol-goalkeeper-glove', type: 'symbol', label: 'Goalkeeper glove' },
  { id: 'symbol-football-shirt', type: 'symbol', label: 'Shirt — green sash' },
  { id: 'symbol-football-shirt-black-white-stripes', type: 'symbol', label: 'Shirt — black/white stripes' },
  { id: 'symbol-football-shirt-all-white', type: 'symbol', label: 'Shirt — all white' },
  { id: 'symbol-football-shirt-all-red', type: 'symbol', label: 'Shirt — all red' },
  { id: 'symbol-football-shirt-blue-white-hoops', type: 'symbol', label: 'Shirt — blue/white hoops' },
  { id: 'symbol-supporter-scarf', type: 'symbol', label: 'Supporter scarf' },
  { id: 'symbol-referee-whistle', type: 'symbol', label: 'Referee whistle' },
  { id: 'symbol-tactics-board', type: 'symbol', label: 'Tactics board' },
  { id: 'symbol-trophy', type: 'symbol', label: 'Trophy' },
  { id: 'symbol-winners-medal', type: 'symbol', label: "Winner's medal" },
  { id: 'symbol-corner-flag', type: 'symbol', label: 'Corner flag' },
  { id: 'symbol-goal-and-net', type: 'symbol', label: 'Goal and net' },
  { id: 'symbol-floodlights', type: 'symbol', label: 'Floodlights' },
  { id: 'symbol-stadium', type: 'symbol', label: 'Stadium' },
  { id: 'symbol-referee-cards', type: 'symbol', label: 'Referee cards' },
  { id: 'symbol-captains-armband', type: 'symbol', label: "Captain's armband" },
  { id: 'symbol-match-stopwatch', type: 'symbol', label: 'Match stopwatch' },
  { id: 'symbol-match-ticket', type: 'symbol', label: 'Match ticket' },
  { id: 'symbol-turnstile', type: 'symbol', label: 'Turnstile' },
  { id: 'symbol-pundit-microphone', type: 'symbol', label: 'Pundit microphone' },
  { id: 'symbol-commentary-headphones', type: 'symbol', label: 'Commentary headphones' },
  { id: 'symbol-match-day-pie', type: 'symbol', label: 'Match-day pie' },
  { id: 'symbol-away-day-coach', type: 'symbol', label: 'Away-day coach' },
  { id: 'symbol-football-programme', type: 'symbol', label: 'Football programme' },
  { id: 'symbol-manager-side-profile', type: 'symbol', label: 'Manager — side profile' },
  { id: 'symbol-goalkeeper-diving', type: 'symbol', label: 'Goalkeeper diving' },
  { id: 'symbol-dugout', type: 'symbol', label: 'Dugout' },
  { id: 'symbol-training-cone', type: 'symbol', label: 'Training cone' },
] as const;

const AVATAR_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
] as const;

type SymbolAvatarId = (typeof SYMBOL_AVATAR_DEFINITIONS)[number]['id'];
type AvatarLetter = Lowercase<(typeof AVATAR_LETTERS)[number]>;
export type AvatarId = SymbolAvatarId | `letter-${AvatarLetter}`;

export interface AvatarDefinition {
  id: AvatarId;
  type: 'symbol' | 'letter';
  label: string;
}

const LETTER_AVATAR_DEFINITIONS: readonly AvatarDefinition[] = AVATAR_LETTERS.map(
  (letter) => ({
    id: `letter-${letter.toLowerCase()}` as AvatarId,
    type: 'letter',
    label: letter,
  })
);

export const AVATAR_DEFINITIONS: readonly AvatarDefinition[] = [
  ...SYMBOL_AVATAR_DEFINITIONS,
  ...LETTER_AVATAR_DEFINITIONS,
];

const AVATAR_IDS = new Set<string>(AVATAR_DEFINITIONS.map(({ id }) => id));

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && AVATAR_IDS.has(value);
}

export function chooseRandomSymbolAvatarId(randomValue = Math.random()): AvatarId {
  const normalized = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.9999999999999999)
    : 0;
  const index = Math.floor(normalized * SYMBOL_AVATAR_DEFINITIONS.length);
  return SYMBOL_AVATAR_DEFINITIONS[index].id;
}

export function resolvePersistedAvatarId(
  currentAvatarId: unknown,
  randomValue = Math.random()
): AvatarId {
  return isAvatarId(currentAvatarId)
    ? currentAvatarId
    : chooseRandomSymbolAvatarId(randomValue);
}
