import{currentFactoryId}from './factoryTeam';
import { getSupabase } from './supabaseClient';
import { qcAction } from './qualityControlDb';
import type { ReportEvidence } from '../data/qualityControl';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
export async function prepareQcFile(file: File, photo: boolean): Promise<File> {
 if (!(photo ? imageTypes : [...imageTypes, 'application/pdf']).includes(file.type)) throw new Error(photo ? 'Choose JPG, PNG or WebP production photos.' : 'Choose a JPG, PNG, WebP or PDF supporting file.');
 if (file.size === 0 || file.size > 50 * 1024 * 1024) throw new Error('Choose files smaller than 50 MB.');
 const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
 const valid = file.type === 'image/jpeg' ? header[0] === 255 && header[1] === 216 && header[2] === 255
  : file.type === 'image/png' ? [137,80,78,71,13,10,26,10].every((v,i) => header[i] === v)
  : file.type === 'image/webp' ? String.fromCharCode(...header.slice(0,4)) === 'RIFF' && String.fromCharCode(...header.slice(8,12)) === 'WEBP'
  : String.fromCharCode(...header.slice(0,5)) === '%PDF-';
 if (!valid) throw new Error(`${file.name}: the file contents do not match its type.`);
 if (!imageTypes.includes(file.type)) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Supporting PDFs must be 10 MB or smaller.');
  return file;
 }
 const bitmap = await createImageBitmap(file);
 try {
  if (bitmap.width * bitmap.height > 100000000) throw new Error('This image is too large to process. Choose a smaller image.');
  if (file.size <= 3 * 1024 * 1024 && Math.max(bitmap.width, bitmap.height) <= 3200) return file;
  const scale = Math.min(1, 3200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d'); if (!context) throw new Error('Image optimisation is unavailable.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not optimise the image.')), 'image/webp', 0.92));
  if (blob.size > 10 * 1024 * 1024) throw new Error('The optimised image still exceeds 10 MB. Choose a smaller image.');
  // Preserve the original if recompression would make it larger and it already fits.
  return blob.size >= file.size && file.size <= 10 * 1024 * 1024 ? file : new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
 } finally { bitmap.close(); }
}

export async function uploadReportFile(orderId: string, reportId: string, file: File, role: 'photo' | 'support'): Promise<ReportEvidence> {
 const client = getSupabase(); const {data:{user},error} = await client.auth.getUser();
 if (error || !user) throw new Error('Sign in to upload production evidence.');
 const path = `${orderId}/${await currentFactoryId()}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
 const uploaded = await client.storage.from('qc-evidence').upload(path, file, {upsert:false,contentType:file.type});
 if (uploaded.error) throw new Error(uploaded.error.message);
 try {
  const id = await qcAction(orderId,'report_evidence',{id:reportId,path,file_name:file.name,file_role:role});
  return {id,order_id:orderId,inspection_id:reportId,path,file_name:file.name,file_role:role,mime_type:file.type,byte_size:file.size,check_id:''} as ReportEvidence;
 } catch(cause) { await client.storage.from('qc-evidence').remove([path]); throw cause; }
}

export async function qcFileUrl(path: string): Promise<string> {
 const {data,error} = await getSupabase().storage.from('qc-evidence').createSignedUrl(path, 60);
 if (error || !data?.signedUrl) throw new Error(error?.message || 'The evidence file could not be opened.');
 return data.signedUrl;
}
