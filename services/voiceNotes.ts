import { createVoiceNote, deleteVoiceNote as deleteVoiceNoteRecord } from '../lib/supabaseQueries';
import { createSignedVoiceNoteUrl, deleteVoiceNoteBlob, uploadVoiceNoteBlob } from './storage';

interface StoreVoiceNoteOptions {
  planId: string;
  blob: Blob;
  transcript?: string | null;
  durationMs?: number | null;
}

export async function storeVoiceNote(options: StoreVoiceNoteOptions) {
  const { planId, blob, transcript, durationMs } = options;

  const path = await uploadVoiceNoteBlob(planId, blob, blob.type);

  try {
    const note = await createVoiceNote({
      planId,
      storagePath: path,
      transcript: transcript ?? null,
      durationSeconds: durationMs ? Math.round(durationMs / 1000) : null
    });

    return note;
  } catch (error) {
    await deleteVoiceNoteBlob(path).catch(() => undefined);
    throw error;
  }
}

export async function removeVoiceNote(noteId: string, storagePath: string) {
  await deleteVoiceNoteRecord(noteId);
  await deleteVoiceNoteBlob(storagePath).catch(() => undefined);
}

export async function getVoiceNoteSignedUrl(path: string, expiresInSeconds = 300) {
  return createSignedVoiceNoteUrl(path, expiresInSeconds);
}
