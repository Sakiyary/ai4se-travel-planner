import type { PostgrestError, User } from '@supabase/supabase-js';
import { supabaseClient } from './supabaseClient';
import { SUPABASE_TABLES } from './constants';

export interface PlanRecord {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  party_size: number | null;
  budget: number | null;
  currency: string | null;
  created_at: string;
}

export interface SavePlanFromItineraryOptions {
  title: string;
  destination?: string | null;
  partySize?: number | null;
  itinerary: Array<{
    day: number;
    summary?: string;
    activities: Array<{
      title: string;
      description?: string;
      city?: string;
      budget?: number;
      startTime?: string;
      endTime?: string;
      poiId?: string;
    }>;
  }>;
  totalBudget?: number | null;
}

interface PlanSegmentDetails {
  summary?: string | null;
  title?: string | null;
  description?: string | null;
  budget?: number | string | null;
  order?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  city?: string | null;
}

export interface PlanActivity {
  id: string;
  title: string;
  description: string | null;
  budget: number | null;
  timeSlot: string | null;
  startTime: string | null;
  endTime: string | null;
  locationId: string | null;
  city: string | null;
  summary: string | null;
  activityType: string | null;
  order: number;
}

export interface PlanDay {
  day: number;
  summary: string | null;
  activities: PlanActivity[];
}

export interface PlanDetail {
  plan: PlanRecord;
  days: PlanDay[];
  totalActivityBudget: number | null;
}

export interface ProfileRecord {
  id: string;
  email: string;
  displayName: string | null;
  defaultCurrency: string | null;
  defaultCompanionCount: number | null;
  createdAt: string;
  updatedAt: string;
  preferences: Record<string, unknown>;
}

export interface UpdateProfileInput {
  displayName?: string | null;
  defaultCurrency?: string | null;
  defaultCompanionCount?: number | null;
}

export interface ExpenseRecord {
  id: string;
  plan_id: string;
  amount: number;
  currency: string | null;
  category: string | null;
  method: string | null;
  source: string | null;
  notes: string | null;
  timestamp: string;
  created_at: string;
}

export interface CreateExpenseInput {
  planId: string;
  amount: number;
  currency?: string | null;
  category?: string | null;
  method?: string | null;
  notes?: string | null;
  timestamp?: string | null;
  source?: string | null;
}

export interface UpdatePlanInput {
  startDate?: string | null;
  endDate?: string | null;
  partySize?: number | null;
  budget?: number | null;
  currency?: string | null;
}

export interface VoiceNoteRecord {
  id: string;
  plan_id: string;
  storage_path: string;
  transcript: string | null;
  duration_seconds: number | null;
  created_at: string;
}

async function getAuthenticatedUser(): Promise<User> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data.user) {
    throw error ?? new Error('User not found');
  }

  return data.user;
}

async function ensureProfileExists(user: User): Promise<void> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_TABLES.PROFILES)
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      if (isSchemaCacheMissing(error)) {
        console.warn('[ensureProfileExists] profiles table not available in schema cache, skipping profile creation');
        return;
      }
      throw error;
    }

    if (data) {
      return;
    }
  } catch (error) {
    if (isSchemaCacheMissing(error)) {
      console.warn('[ensureProfileExists] Unable to query profiles due to schema cache, skipping');
      return;
    }
    throw error;
  }

  try {
    const { error: insertError } = await supabaseClient.from(SUPABASE_TABLES.PROFILES).insert({
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.full_name ?? null
    });

    if (insertError && insertError.code !== '23505') {
      if (isSchemaCacheMissing(insertError)) {
        console.warn('[ensureProfileExists] Insert skipped because profiles table missing in schema cache');
        return;
      }
      throw insertError;
    }
  } catch (error) {
    if (isSchemaCacheMissing(error)) {
      console.warn('[ensureProfileExists] Insert failed due to schema cache, skipping');
      return;
    }
    throw error;
  }
}

async function fetchProfileRow(userId: string): Promise<Record<string, unknown> | null> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLES.PROFILES)
    .select('id, email, display_name, preferences, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (isSchemaCacheMissing(error)) {
      throw new Error('Supabase 尚未刷新 schema 缓存，请稍后再试或在 Supabase 控制台刷新 schema。');
    }
    throw error;
  }

  return (data ?? null) as Record<string, unknown> | null;
}

export async function fetchCurrentProfile(): Promise<ProfileRecord | null> {
  const user = await getAuthenticatedUser();
  await ensureProfileExists(user);

  const row = await fetchProfileRow(user.id);
  if (!row) {
    return null;
  }

  return normalizeProfile(row);
}

export async function updateProfile(updates: UpdateProfileInput): Promise<ProfileRecord> {
  const user = await getAuthenticatedUser();
  await ensureProfileExists(user);

  const existingRow = await fetchProfileRow(user.id);
  if (!existingRow) {
    throw new Error('当前用户资料不存在，请稍后再试。');
  }

  const existingProfile = normalizeProfile(existingRow);
  const payload: Record<string, unknown> = {};
  let hasChange = false;

  if (updates.displayName !== undefined) {
    const trimmed = updates.displayName?.trim();
    payload.display_name = trimmed && trimmed.length > 0 ? trimmed : null;
    hasChange = true;
  }

  const nextPreferences = { ...existingProfile.preferences };
  let preferencesChanged = false;

  if (updates.defaultCurrency !== undefined) {
    const normalizedCurrency = updates.defaultCurrency
      ? updates.defaultCurrency.trim().toUpperCase()
      : null;
    nextPreferences.default_currency = normalizedCurrency;
    preferencesChanged = true;
  }

  if (updates.defaultCompanionCount !== undefined) {
    let normalizedCount: number | null = null;
    if (updates.defaultCompanionCount !== null && Number.isFinite(updates.defaultCompanionCount)) {
      normalizedCount = Math.max(0, Math.trunc(updates.defaultCompanionCount));
    }
    nextPreferences.default_companion_count = normalizedCount;
    preferencesChanged = true;
  }

  if (preferencesChanged) {
    payload.preferences = nextPreferences;
    hasChange = true;
  }

  if (!hasChange) {
    throw new Error('No profile fields provided for update.');
  }

  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabaseClient!
    .from(SUPABASE_TABLES.PROFILES)
    .update(payload)
    .eq('id', user.id)
    .select('id, email, display_name, preferences, created_at, updated_at')
    .single();

  if (error || !data) {
    if (error && isSchemaCacheMissing(error)) {
      throw new Error('Supabase 尚未刷新 schema 缓存，请稍后再试或在 Supabase 控制台刷新 schema。');
    }
    throw error ?? new Error('更新用户资料失败');
  }

  return normalizeProfile(data as Record<string, unknown>);
}

export async function savePlanFromItinerary(options: SavePlanFromItineraryOptions): Promise<string> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const user = await getAuthenticatedUser();
  await ensureProfileExists(user);

  const sanitizePoiId = (value?: string | null) => {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return /^B0[0-9A-Z]{8}$/i.test(trimmed) ? trimmed : null;
  };

  const normalizedPartySize =
    typeof options.partySize === 'number' && Number.isFinite(options.partySize)
      ? Math.max(1, Math.trunc(options.partySize))
      : null;

  const planPayload = {
    user_id: user.id,
    title: options.title.trim() || 'AI 行程计划',
    destination: options.destination?.trim() || null,
    budget: typeof options.totalBudget === 'number' ? options.totalBudget : null,
    currency: 'CNY',
    party_size: normalizedPartySize
  } satisfies Record<string, unknown>;

  const planResponse = await supabaseClient
    .from(SUPABASE_TABLES.PLANS)
    .insert(planPayload)
    .select('id')
    .single();

  if (planResponse.error || !planResponse.data) {
    if (planResponse.error && isSchemaCacheMissing(planResponse.error)) {
      throw new Error('Supabase 尚未刷新 schema 缓存，请稍后再试或在 Supabase 控制台执行 schema reload。');
    }
    throw planResponse.error ?? new Error('Failed to create plan');
  }

  const planId = planResponse.data.id as string;

  const segments = options.itinerary.flatMap((day) =>
    day.activities.map((activity, index) => ({
      plan_id: planId,
      day_index: day.day,
      time_slot:
        activity.startTime && activity.endTime
          ? `${activity.startTime}-${activity.endTime}`
          : activity.startTime ?? activity.endTime ?? null,
      activity_type: 'activity',
      location_id: sanitizePoiId(activity.poiId ?? null),
      details: {
        summary: day.summary ?? null,
        title: activity.title,
        description: activity.description ?? null,
        budget: typeof activity.budget === 'number' ? activity.budget : null,
        order: index,
        startTime: activity.startTime ?? null,
        endTime: activity.endTime ?? null,
        city: activity.city ?? null
      }
    }))
  );

  if (segments.length > 0) {
    const { error: segmentsError } = await supabaseClient
      .from(SUPABASE_TABLES.PLAN_SEGMENTS)
      .insert(segments);

    if (segmentsError) {
      throw segmentsError;
    }
  }

  return planId;
}

export async function fetchPlans(): Promise<PlanRecord[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLES.PLANS)
    .select('id, user_id, title, destination, start_date, end_date, party_size, budget, currency, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((plan) => ({
    ...plan,
    budget:
      plan.budget === null || typeof plan.budget === 'number'
        ? (plan.budget as number | null)
        : Number(plan.budget)
  })) as PlanRecord[];
}

export async function fetchPlanDetail(planId: string): Promise<PlanDetail> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLES.PLANS)
    .select(`
      id,
      user_id,
      title,
      destination,
      start_date,
      end_date,
      party_size,
      budget,
      currency,
      created_at,
      plan_segments (
        id,
        day_index,
        time_slot,
        activity_type,
        location_id,
        details
      )
    `)
    .eq('id', planId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('未找到对应的旅行计划。');
  }

  const rawPartySize =
    data.party_size === null || data.party_size === undefined
      ? null
      : typeof data.party_size === 'number'
        ? data.party_size
        : Number(data.party_size);

  const normalizedPartySize =
    rawPartySize === null || Number.isNaN(rawPartySize) || !Number.isFinite(rawPartySize)
      ? null
      : Math.max(0, Math.trunc(rawPartySize));

  const rawBudget =
    data.budget === null || data.budget === undefined
      ? null
      : typeof data.budget === 'number'
        ? data.budget
        : Number(data.budget);

  const normalizedBudget =
    rawBudget === null || Number.isNaN(rawBudget) || !Number.isFinite(rawBudget) ? null : rawBudget;

  const plan: PlanRecord = {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    destination: data.destination ?? null,
    start_date: data.start_date ?? null,
    end_date: data.end_date ?? null,
    party_size: normalizedPartySize,
    budget: normalizedBudget,
    currency: data.currency ?? null,
    created_at: data.created_at
  };

  const segments: Array<{
    id: string;
    day_index: number;
    time_slot: string | null;
    activity_type: string | null;
    location_id: string | null;
    details: PlanSegmentDetails | null;
  }> = (data.plan_segments ?? []).map((segment: Record<string, unknown>) => ({
    id: String(segment.id),
    day_index: typeof segment.day_index === 'number' ? segment.day_index : Number(segment.day_index ?? 0),
    time_slot: typeof segment.time_slot === 'string' ? segment.time_slot : null,
    activity_type: typeof segment.activity_type === 'string' ? segment.activity_type : null,
    location_id: typeof segment.location_id === 'string' ? segment.location_id : null,
    details: (segment.details ?? null) as PlanSegmentDetails | null
  }));

  const daysMap = new Map<number, PlanDay>();

  for (const segment of segments) {
    const currentDay = daysMap.get(segment.day_index) ?? {
      day: segment.day_index,
      summary: null,
      activities: [] as PlanActivity[]
    };

    const detail = segment.details ?? {};
    const summary = typeof detail.summary === 'string' && detail.summary.trim().length > 0 ? detail.summary : null;
    if (!currentDay.summary && summary) {
      currentDay.summary = summary;
    }

    const rawOrder =
      typeof detail.order === 'number'
        ? detail.order
        : typeof detail.order === 'string'
          ? Number(detail.order)
          : currentDay.activities.length;

    const normalizedOrder =
      Number.isFinite(rawOrder) && !Number.isNaN(rawOrder) ? rawOrder : currentDay.activities.length;

    const rawBudgetValue =
      detail?.budget === null || detail?.budget === undefined
        ? null
        : typeof detail.budget === 'number'
          ? detail.budget
          : Number(detail.budget);

    const normalizedBudgetValue =
      rawBudgetValue === null || Number.isNaN(rawBudgetValue) || !Number.isFinite(rawBudgetValue)
        ? null
        : rawBudgetValue;

    currentDay.activities.push({
      id: segment.id,
      title: typeof detail.title === 'string' && detail.title.trim().length > 0 ? detail.title : '未命名活动',
      description: typeof detail.description === 'string' ? detail.description : null,
      budget: normalizedBudgetValue,
      timeSlot: segment.time_slot,
      startTime: typeof detail.startTime === 'string' ? detail.startTime : null,
      endTime: typeof detail.endTime === 'string' ? detail.endTime : null,
      locationId: segment.location_id,
      city: typeof detail.city === 'string' && detail.city.trim().length > 0 ? detail.city : null,
      summary,
      activityType: segment.activity_type,
      order: normalizedOrder
    });

    daysMap.set(segment.day_index, currentDay);
  }

  const days: PlanDay[] = Array.from(daysMap.values())
    .sort((a, b) => a.day - b.day)
    .map((day) => ({
      ...day,
      activities: [...day.activities].sort((a, b) => a.order - b.order)
    }));

  const totalActivityBudget = days.reduce((total, day) => {
    return (
      total +
      day.activities.reduce((daySum, activity) => {
        return daySum + (typeof activity.budget === 'number' ? activity.budget : 0);
      }, 0)
    );
  }, 0);

  return {
    plan,
    days,
    totalActivityBudget: totalActivityBudget > 0 ? totalActivityBudget : null
  } satisfies PlanDetail;
}

export async function updatePlan(planId: string, updates: UpdatePlanInput): Promise<PlanRecord> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const payload: Record<string, unknown> = {};

  if (updates.startDate !== undefined) {
    payload.start_date = updates.startDate ?? null;
  }

  if (updates.endDate !== undefined) {
    payload.end_date = updates.endDate ?? null;
  }

  if (updates.partySize !== undefined) {
    payload.party_size = updates.partySize ?? null;
  }

  if (updates.budget !== undefined) {
    payload.budget = updates.budget ?? null;
  }

  if (updates.currency !== undefined) {
    payload.currency = updates.currency ?? null;
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('No plan fields provided for update.');
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLES.PLANS)
    .update(payload)
    .eq('id', planId)
    .select('id, user_id, title, destination, start_date, end_date, party_size, budget, currency, created_at')
    .single();

  if (error || !data) {
    throw error ?? new Error('更新计划失败');
  }

  const updatedBudget =
    data.budget === null || data.budget === undefined
      ? null
      : typeof data.budget === 'number'
        ? data.budget
        : Number(data.budget);

  const updatedPartySize =
    data.party_size === null || data.party_size === undefined
      ? null
      : typeof data.party_size === 'number'
        ? data.party_size
        : Number(data.party_size);

  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    destination: data.destination,
    start_date: data.start_date,
    end_date: data.end_date,
    party_size: updatedPartySize,
    budget: updatedBudget,
    currency: data.currency,
    created_at: data.created_at
  } satisfies PlanRecord;
}

export async function deletePlan(planId: string): Promise<void> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { error } = await supabaseClient.from(SUPABASE_TABLES.PLANS).delete().eq('id', planId);

  if (error) {
    throw error;
  }
}

function isSchemaCacheMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'PGRST205';
}

function normalizeProfile(row: Record<string, unknown>): ProfileRecord {
  const rawPreferences =
    typeof row.preferences === 'object' && row.preferences !== null && !Array.isArray(row.preferences)
      ? { ...(row.preferences as Record<string, unknown>) }
      : {};

  const currencyValue = rawPreferences.default_currency;
  const normalizedCurrency =
    typeof currencyValue === 'string' && currencyValue.trim().length > 0
      ? currencyValue.trim().toUpperCase()
      : null;

  const companionValue = rawPreferences.default_companion_count;
  let normalizedCompanion: number | null = null;
  if (typeof companionValue === 'number') {
    normalizedCompanion = Math.max(0, Math.trunc(companionValue));
  } else if (typeof companionValue === 'string') {
    const parsed = Number(companionValue);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      normalizedCompanion = Math.max(0, Math.trunc(parsed));
    }
  }

  if (normalizedCurrency === null) {
    delete rawPreferences.default_currency;
  } else {
    rawPreferences.default_currency = normalizedCurrency;
  }

  rawPreferences.default_companion_count = normalizedCompanion;

  const displayNameRaw = typeof row.display_name === 'string' ? row.display_name.trim() : '';
  const displayName = displayNameRaw.length > 0 ? displayNameRaw : null;

  return {
    id: String(row.id),
    email: typeof row.email === 'string' ? row.email : '',
    displayName,
    defaultCurrency: normalizedCurrency,
    defaultCompanionCount: normalizedCompanion,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
    preferences: rawPreferences
  } satisfies ProfileRecord;
}

function normalizeExpense(row: Record<string, unknown>): ExpenseRecord {
  const rawAmount =
    row.amount === null || row.amount === undefined
      ? null
      : typeof row.amount === 'number'
        ? row.amount
        : Number(row.amount);

  const amount = rawAmount === null || Number.isNaN(rawAmount) || !Number.isFinite(rawAmount) ? 0 : rawAmount;

  return {
    id: String(row.id),
    plan_id: String(row.plan_id),
    amount,
    currency: typeof row.currency === 'string' ? row.currency : null,
    category: typeof row.category === 'string' ? row.category : null,
    method: typeof row.method === 'string' ? row.method : null,
    source: typeof row.source === 'string' ? row.source : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    timestamp: typeof row.timestamp === 'string' ? row.timestamp : new Date().toISOString(),
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString()
  } satisfies ExpenseRecord;
}

export async function fetchExpenses(planId: string): Promise<ExpenseRecord[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLES.EXPENSES)
    .select('id, plan_id, amount, currency, category, method, source, notes, timestamp, created_at')
    .eq('plan_id', planId)
    .order('timestamp', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => normalizeExpense(row as Record<string, unknown>));
}

export async function createExpense(input: CreateExpenseInput): Promise<ExpenseRecord> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('费用金额必须大于 0。');
  }

  const payload = {
    plan_id: input.planId,
    amount: input.amount,
    currency: input.currency ?? 'CNY',
    category: input.category ?? null,
    method: input.method ?? null,
    notes: input.notes ?? null,
    source: input.source ?? 'manual',
    timestamp: input.timestamp ?? new Date().toISOString()
  } satisfies Record<string, unknown>;

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLES.EXPENSES)
    .insert(payload)
    .select('id, plan_id, amount, currency, category, method, source, notes, timestamp, created_at')
    .single();

  if (error || !data) {
    throw error ?? new Error('创建费用记录失败');
  }

  return normalizeExpense(data as Record<string, unknown>);
}

export async function deleteExpense(expenseId: string): Promise<void> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { error } = await supabaseClient
    .from(SUPABASE_TABLES.EXPENSES)
    .delete()
    .eq('id', expenseId);

  if (error) {
    throw error;
  }
}

export function mapSupabaseError(error: PostgrestError | Error): string {
  if ('message' in error) {
    return error.message;
  }
  return 'Unexpected Supabase error';
}

export async function fetchVoiceNotes(planId: string): Promise<VoiceNoteRecord[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLES.VOICE_NOTES ?? 'voice_notes')
    .select('id, plan_id, storage_path, transcript, duration_seconds, created_at')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    plan_id: String(row.plan_id),
    storage_path: String(row.storage_path),
    transcript: typeof row.transcript === 'string' ? row.transcript : null,
    duration_seconds:
      row.duration_seconds === null || row.duration_seconds === undefined
        ? null
        : typeof row.duration_seconds === 'number'
          ? row.duration_seconds
          : Number(row.duration_seconds),
    created_at: String(row.created_at)
  }));
}

export async function createVoiceNote(input: {
  planId: string;
  storagePath: string;
  transcript?: string | null;
  durationSeconds?: number | null;
}): Promise<VoiceNoteRecord> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const payload = {
    plan_id: input.planId,
    storage_path: input.storagePath,
    transcript: input.transcript ?? null,
    duration_seconds: input.durationSeconds ?? null
  } satisfies Record<string, unknown>;

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLES.VOICE_NOTES ?? 'voice_notes')
    .insert(payload)
    .select('id, plan_id, storage_path, transcript, duration_seconds, created_at')
    .single();

  if (error || !data) {
    throw error ?? new Error('创建语音笔记失败');
  }

  return {
    id: String(data.id),
    plan_id: String(data.plan_id),
    storage_path: String(data.storage_path),
    transcript: typeof data.transcript === 'string' ? data.transcript : null,
    duration_seconds:
      data.duration_seconds === null || data.duration_seconds === undefined
        ? null
        : typeof data.duration_seconds === 'number'
          ? data.duration_seconds
          : Number(data.duration_seconds),
    created_at: String(data.created_at)
  } satisfies VoiceNoteRecord;
}

export async function deleteVoiceNote(noteId: string): Promise<void> {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  const { error } = await supabaseClient
    .from(SUPABASE_TABLES.VOICE_NOTES ?? 'voice_notes')
    .delete()
    .eq('id', noteId);

  if (error) {
    throw error;
  }
}
