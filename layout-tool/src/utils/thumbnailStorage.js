import { supabase } from '../lib/supabase';

const BUCKET = 'layout-thumbnails';

export async function uploadThumbnail(layoutId, pngBlob) {
  const path = `${layoutId}/thumbnail.png`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, pngBlob, { contentType: 'image/png', upsert: true });

  if (error) {
    console.error('Thumbnail upload failed:', error);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Bust the cache so the new thumbnail shows immediately
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function saveThumbnailUrl(layoutId, url) {
  const { error } = await supabase
    .from('layouts')
    .update({ thumbnail_url: url })
    .eq('id', layoutId);

  if (error) console.error('Thumbnail URL save failed:', error);
}
