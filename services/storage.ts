import { getSupabaseClient } from '../lib/supabaseClient';
import { getRuntimeConfig } from '../lib/runtimeConfig';

function resolveExportBucket() {
  return getRuntimeConfig().supabaseExportBucket ?? 'plan-exports';
}

function resolveVoiceBucket() {
  return getRuntimeConfig().supabaseVoiceBucket ?? 'voice-notes';
}

export async function savePlanDocument(planId: string, payload: Blob) {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    throw new Error('Supabase 客户端未初始化。');
  }

  const path = `plans/${planId}/${Date.now()}.json`;
  const { error } = await supabaseClient.storage
    .from(resolveExportBucket())
    .upload(path, payload, {
      contentType: 'application/json',
      upsert: true
    });

  if (error) {
    throw error;
  }

  return path;
}

export async function uploadVoiceNoteBlob(planId: string, blob: Blob, contentType?: string) {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    throw new Error('Supabase 客户端未初始化。');
  }

  const resolvedContentType = contentType ?? blob.type ?? 'audio/webm';
  const extension = guessExtension(resolvedContentType);
  // Store under plan-specific folder inside the bucket; bucket name already prefixes the storage key.
  const path = `${planId}/${Date.now()}.${extension}`;

  const { data, error } = await supabaseClient.storage
    .from(resolveVoiceBucket())
    .upload(path, blob, {
      contentType: resolvedContentType,
      upsert: false
    });

  if (error) {
    throw error;
  }

  return data?.path ?? path;
}

export async function deleteVoiceNoteBlob(path: string) {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    throw new Error('Supabase 客户端未初始化。');
  }

  const { error } = await supabaseClient.storage.from(resolveVoiceBucket()).remove([path]);
  if (error) {
    throw error;
  }
}

export async function createSignedVoiceNoteUrl(path: string, expiresInSeconds = 300) {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    throw new Error('Supabase 客户端未初始化。');
  }

  const { data, error } = await supabaseClient.storage
    .from(resolveVoiceBucket())
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    throw error ?? new Error('无法生成语音笔记播放链接。');
  }

  return data.signedUrl;
}

function guessExtension(contentType: string) {
  if (contentType.includes('webm')) {
    return 'webm';
  }
  if (contentType.includes('wav')) {
    return 'wav';
  }
  if (contentType.includes('mpeg')) {
    return 'mp3';
  }
  if (contentType.includes('ogg')) {
    return 'ogg';
  }
  if (contentType.includes('x-wav') || contentType.includes('wave')) {
    return 'wav';
  }
  return 'pcm';
}
