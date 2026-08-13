export interface RankableCareerRow {
  category?: string;
  rank?: number;
}

export interface DateScopedCareerResult {
  date: string;
}

const CATEGORY_ORDER: Record<string, number> = {
  domestic: 0,
  international: 1,
};

export function orderCareerRows<T extends RankableCareerRow>(rows: T[]): T[] {
  return rows.slice().sort((left, right) => {
    const leftCategory = CATEGORY_ORDER[left.category?.trim().toLowerCase() ?? ''] ?? 2;
    const rightCategory = CATEGORY_ORDER[right.category?.trim().toLowerCase() ?? ''] ?? 2;
    return leftCategory - rightCategory || (left.rank ?? 0) - (right.rank ?? 0);
  });
}

export function getCareerResultForDate<T extends DateScopedCareerResult>(
  result: T | null | undefined,
  date: string
): T | null {
  return result?.date === date ? result : null;
}
