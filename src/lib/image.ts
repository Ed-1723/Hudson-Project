// Downscales and compresses a photo client-side before it goes over the
// wire to the Edge Function - a full-res phone photo is overkill for
// reading a nutrition label and would bloat the request.
const MAX_DIMENSION = 1200
const JPEG_QUALITY = 0.82

export interface EncodedImage {
  base64: string
  mediaType: string
}

export async function fileToCompressedImage(file: File): Promise<EncodedImage> {
  const bitmap = await createImageBitmap(file)

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process image')
  ctx.drawImage(bitmap, 0, 0, width, height)

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const [, base64] = dataUrl.split(',')

  return { base64, mediaType: 'image/jpeg' }
}
