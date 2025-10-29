import { supabaseClient } from '../lib/supabaseClient';

const EXPORT_BUCKET =
  process.env.SUPABASE_EXPORT_BUCKET ?? process.env.NEXT_PUBLIC_SUPABASE_EXPORT_BUCKET ?? 'plan-exports';
const VOICE_BUCKET =
  process.env.SUPABASE_VOICE_BUCKET ?? process.env.NEXT_PUBLIC_SUPABASE_VOICE_BUCKET ?? 'voice-notes';

export async function savePlanDocument(planId: string, payload: Blob) {
  if (!supabaseClient) {
    throw new Error('Supabase 客户端未初始化。');
  }

  const path = `plans/${planId}/${Date.now()}.json`;
  const { error } = await supabaseClient.storage
    .from(EXPORT_BUCKET)
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
  if (!supabaseClient) {
    throw new Error('Supabase 客户端未初始化。');
  }

  const resolvedContentType = contentType ?? blob.type ?? 'audio/webm';
  const extension = guessExtension(resolvedContentType);
  // Store under plan-specific folder inside the bucket; bucket name already prefixes the storage key.
  const path = `${planId}/${Date.now()}.${extension}`;

  const { data, error } = await supabaseClient.storage
    .from(VOICE_BUCKET)
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
  if (!supabaseClient) {
    throw new Error('Supabase 客户端未初始化。');
  }

  const { error } = await supabaseClient.storage.from(VOICE_BUCKET).remove([path]);
  if (error) {
    throw error;
  }
}

export async function createSignedVoiceNoteUrl(path: string, expiresInSeconds = 300) {
  if (!supabaseClient) {
    throw new Error('Supabase 客户端未初始化。');
  }

  const { data, error } = await supabaseClient.storage
    .from(VOICE_BUCKET)
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
