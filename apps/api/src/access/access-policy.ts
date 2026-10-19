export const PLAN_CODES = ['FREE', 'MEDIUM', 'ADVANCED'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const PLAN_MODULE_LIMIT: Record<PlanCode, number> = {
  FREE: 8,
  MEDIUM: 10,
  ADVANCED: 12,
};

export const ENTITLEMENT_CATALOG = {
  'learning.materials.read': { FREE: true, MEDIUM: true, ADVANCED: true },
  'learning.modules.max': { FREE: 8, MEDIUM: 10, ADVANCED: 12 },
  'assessment.overview.read': { FREE: true, MEDIUM: true, ADVANCED: true },
  'assignments.standard.read': { FREE: true, MEDIUM: true, ADVANCED: true },
  'assignments.standard.submit': { FREE: true, MEDIUM: true, ADVANCED: true },
  'student_store.submit': { FREE: true, MEDIUM: true, ADVANCED: true },
  'affiliate.content.submit': { FREE: true, MEDIUM: true, ADVANCED: true },
  'affiliate.metrics.manage': { FREE: true, MEDIUM: true, ADVANCED: true },
  'dashboards.advanced.read': { FREE: false, MEDIUM: false, ADVANCED: true },
  'reports.export': { FREE: false, MEDIUM: false, ADVANCED: true },
  'early_warnings.read': { FREE: false, MEDIUM: false, ADVANCED: true },
  'support.advanced.use': { FREE: false, MEDIUM: false, ADVANCED: true },
} as const;

export type GrantScope = 'ORGANIZATION' | 'SCHOOL' | 'PROGRAM' | 'CLASS' | 'USER';

export interface EffectiveGrantCandidate {
  id: string;
  planCode: string;
  planRank: number;
  moduleLimit: number;
  scope: GrantScope;
  startsAt: Date;
  endsAt?: Date | null;
  status: string;
  source: string;
}

const SCOPE_PRIORITY: Record<GrantScope, number> = {
  ORGANIZATION: 1,
  SCHOOL: 2,
  PROGRAM: 3,
  CLASS: 3,
  USER: 4,
};

export function isGrantEffective(candidate: EffectiveGrantCandidate, now = new Date()): boolean {
  if (!['ACTIVE', 'SCHEDULED'].includes(candidate.status)) return false;
  if (candidate.startsAt.getTime() > now.getTime()) return false;
  return !candidate.endsAt || candidate.endsAt.getTime() > now.getTime();
}

export function selectEffectiveGrant(
  candidates: EffectiveGrantCandidate[],
  now = new Date(),
): EffectiveGrantCandidate | null {
  return candidates
    .filter((candidate) => isGrantEffective(candidate, now))
    .sort((left, right) => {
      const scopeDifference = SCOPE_PRIORITY[right.scope] - SCOPE_PRIORITY[left.scope];
      if (scopeDifference !== 0) return scopeDifference;
      const rankDifference = right.planRank - left.planRank;
      if (rankDifference !== 0) return rankDifference;
      return right.startsAt.getTime() - left.startsAt.getTime();
    })[0] ?? null;
}

export function isPublishedModuleAccessible(
  publishedSequence: number,
  effectiveModuleLimit: number,
  effectivePlanRank: number,
  minimumPlanRank = 0,
): boolean {
  return publishedSequence >= 1
    && publishedSequence <= Math.min(effectiveModuleLimit, 12)
    && effectivePlanRank >= minimumPlanRank;
}
