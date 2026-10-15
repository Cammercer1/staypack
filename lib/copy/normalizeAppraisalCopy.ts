/** Keep list text untouched while typing; clean empty lines only at persistence. */
export function normalizeAppraisalCopy<T extends {
  appeal_points: string[];
  supporting_factors: string[];
  buyer_checks: string[];
}>(copy: T): T {
  const lines = (items: string[]) => (items ?? []).map((line) => line.trim()).filter(Boolean);
  return {
    ...copy,
    appeal_points: lines(copy.appeal_points),
    supporting_factors: lines(copy.supporting_factors),
    buyer_checks: lines(copy.buyer_checks),
  };
}
