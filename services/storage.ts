import { supabaseClient } from '../lib/supabaseClient';

export async function savePlanDocument(planId: string, payload: Blob) {
  if (!supabaseClient) {
    throw new Error('Supabase 客户端未初始化。');
  }

  const path = `plans/${planId}/${Date.now()}.json`;
  const bucket = process.env.SUPABASE_EXPORT_BUCKET
    ?? process.env.NEXT_PUBLIC_SUPABASE_EXPORT_BUCKET
    ?? 'plan-exports';

  const { error } = await supabaseClient.storage
    .from(bucket)
    .upload(path, payload, {
      contentType: 'application/json',
      upsert: true
    });

  if (error) {
    throw error;
  }

  return path;
}
