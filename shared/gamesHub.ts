export type HubModeState = 'available' | 'completed';

export function getGamesHubCompletionState(
  hasQuizResult: boolean,
  hasCareerResult: boolean
): { quiz: HubModeState; career: HubModeState } {
  return {
    quiz: hasQuizResult ? 'completed' : 'available',
    career: hasCareerResult ? 'completed' : 'available',
  };
}
