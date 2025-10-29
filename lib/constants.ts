export const APP_NAME = 'AI 旅行规划师';
export const DASHBOARD_TITLE = '我的旅行计划';

export const SUPABASE_TABLES = {
  PROFILES: 'profiles',
  PLANS: 'plans',
  PLAN_SEGMENTS: 'plan_segments',
  EXPENSES: 'expenses',
  VOICE_NOTES: 'voice_notes'
} as const;

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  PLANNER: '/planner',
  EXPENSES: '/expenses',
  PLANS: '/plans'
} as const;

export function getPlanDetailRoute(planId: string): string {
  return `${ROUTES.PLANS}/${planId}`;
}
