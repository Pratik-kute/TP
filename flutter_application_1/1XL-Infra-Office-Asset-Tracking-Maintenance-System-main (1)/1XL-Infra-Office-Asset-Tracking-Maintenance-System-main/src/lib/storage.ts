import { supabase } from './supabase';

// Multi-file storage helpers (v17)
const INVOICE_BUCKET = 'invoices';
const IMAGE_BUCKET = 'asset-images';
const DOCUMENTS_BUCKET = 'documents';

/**
 * Upload an invoice file to Supabase Storage.
 * Uses a timestamp prefix to allow multiple invoices per asset.
 * Returns the public URL of the uploaded file.
 */
export async function uploadInvoice(
  orgId: string,
  assetId: string,
  file: File
): Promise<string> {
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${orgId}/${assetId}/${Date.now()}_${safeFilename}`;
  const { error } = await supabase.storage
    .from(INVOICE_BUCKET)
    .upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage
    .from(INVOICE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload an asset image to Supabase Storage.
 * Uses a timestamp + random suffix to allow multiple images per asset.
 * Returns the public URL of the uploaded image.
 */
export async function uploadAssetImage(
  orgId: string,
  assetId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const rand = Math.random().toString(36).slice(2, 7);
  const path = `${orgId}/${assetId}/${Date.now()}_${rand}.${ext}`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage
    .from(IMAGE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage by its full public URL.
 * Extracts the storage path from the URL automatically.
 */
export async function deleteStorageFile(
  bucket: 'asset-images' | 'invoices',
  publicUrl: string
): Promise<void> {
  // URL format: .../storage/v1/object/public/{bucket}/{path}
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return; // can't parse path, skip
  const path = decodeURIComponent(publicUrl.slice(idx + marker.length));
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.error('Storage delete error:', error);
}

/**
 * Delete an asset image from Supabase Storage.
 */
export async function deleteAssetImage(
  orgId: string,
  assetId: string,
  fileName: string
): Promise<void> {
  const path = `${orgId}/${assetId}/${fileName}`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .remove([path]);
  if (error) throw error;
}

export async function deleteInvoice(
  orgId: string,
  assetId: string,
  fileName: string
): Promise<void> {
  const path = `${orgId}/${assetId}/${fileName}`;
  const { error } = await supabase.storage
    .from(INVOICE_BUCKET)
    .remove([path]);
  if (error) throw error;
}

/**
 * Upload a standalone document to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadDocument(
  orgId: string,
  file: File
): Promise<string> {
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${orgId}/${Date.now()}_${safeFilename}`;
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage
    .from(DOCUMENTS_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a document file from Supabase Storage by its public URL.
 */
export async function deleteDocument(publicUrl: string): Promise<void> {
  const marker = `/object/public/${DOCUMENTS_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = decodeURIComponent(publicUrl.slice(idx + marker.length));
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
  if (error) console.error('Document delete error:', error);
}
