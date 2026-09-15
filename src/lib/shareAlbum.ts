import { renderSongPreviewWav } from './audioEngine'
import type { SongResult } from '../types'

export interface AlbumVisual {
  seed: number
  rotation: number
  orbitScale: number
}

export interface AlbumAssets {
  cover: Blob
  poster: Blob
  audio: Blob
}

const assetCache = new Map<string, Promise<AlbumAssets>>()

function hash(value: string) {
  let output = 0
  for (let index = 0; index < value.length; index += 1) {
    output = (output * 31 + value.charCodeAt(index)) >>> 0
  }
  return output
}

export function getAlbumVisual(result: SongResult): AlbumVisual {
  const seed = hash(result.story)
  return {
    seed,
    rotation: (seed % 42) - 21,
    orbitScale: 0.82 + (seed % 18) / 100,
  }
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = []
  let current = ''
  for (const character of text) {
    if (context.measureText(current + character).width > maxWidth && current) {
      lines.push(current)
      current = character
      if (lines.length === maxLines - 1) break
    } else {
      current += character
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  const consumed = lines.join('').length
  if (consumed < text.length && lines.length) {
    lines[lines.length - 1] = `${lines.at(-1)?.slice(0, -1)}…`
  }
  return lines
}

async function createAlbumCover(result: SongResult) {
  await document.fonts?.ready
  const size = 1080
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')

  const visual = getAlbumVisual(result)
  const background = context.createLinearGradient(0, 0, size, size)
  background.addColorStop(0, '#f4eee3')
  background.addColorStop(0.58, '#e8dfd1')
  background.addColorStop(1, result.mood.accent)
  context.fillStyle = background
  context.fillRect(0, 0, size, size)

  context.save()
  context.translate(710, 355)
  context.rotate(visual.rotation * Math.PI / 180)
  for (let ring = 9; ring >= 0; ring -= 1) {
    const radius = 72 + ring * 37
    context.beginPath()
    context.ellipse(0, 0, radius * visual.orbitScale, radius, 0, 0, Math.PI * 2)
    context.fillStyle = ring % 2 === 0 ? `${result.mood.color}18` : `${result.mood.accent}32`
    context.fill()
  }
  context.beginPath()
  context.arc(0, 0, 92, 0, Math.PI * 2)
  context.fillStyle = result.mood.color
  context.fill()
  context.beginPath()
  context.arc(0, 0, 15, 0, Math.PI * 2)
  context.fillStyle = '#f4eee3'
  context.fill()
  context.restore()

  context.strokeStyle = result.mood.color
  context.lineWidth = 8
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(90, 112)
  context.lineTo(165, 112)
  context.stroke()

  context.fillStyle = '#292823'
  context.font = '600 28px "DM Sans", sans-serif'
  context.letterSpacing = '5px'
  context.fillText('A PRIVATE RECORD', 190, 122)

  context.font = '600 74px "Noto Serif SC", "Songti SC", serif'
  const titleLines = wrapText(context, `《${result.title}》`, 760, 2)
  titleLines.forEach((line, index) => context.fillText(line, 90, 625 + index * 94))

  context.fillStyle = result.mood.color
  context.font = '600 28px "DM Sans", "PingFang SC", sans-serif'
  context.fillText(`${result.mood.label} · ${result.mood.tempo} BPM · ${result.mood.genre}`, 94, 815)

  context.fillStyle = 'rgba(41, 40, 35, .68)'
  context.font = '500 30px "Noto Serif SC", "Songti SC", serif'
  const storyLines = wrapText(context, result.story, 870, 2)
  storyLines.forEach((line, index) => context.fillText(line, 94, 884 + index * 49))

  context.fillStyle = 'rgba(41, 40, 35, .45)'
  context.font = '500 23px "DM Sans", sans-serif'
  context.letterSpacing = '2px'
  context.fillText('叙音 XIYIN · PRIVATE RECORD 01', 94, 1010)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Unable to create album cover'))
    }, 'image/png')
  })
}

async function createStoryPoster(result: SongResult, cover: Blob) {
  const width = 1080
  const height = 1350
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')
  const coverImage = await createImageBitmap(cover)
  context.drawImage(coverImage, 0, 0, width, width)
  coverImage.close()

  context.fillStyle = '#292823'
  context.fillRect(0, width, width, height - width)
  context.fillStyle = result.mood.accent
  context.fillRect(88, 1142, 62, 7)
  context.fillStyle = '#f3ede2'
  context.font = '600 31px "Noto Serif SC", "Songti SC", serif'
  context.fillText(result.theme, 88, 1215)
  context.fillStyle = 'rgba(243, 237, 226, .65)'
  context.font = '500 24px "DM Sans", "PingFang SC", sans-serif'
  context.letterSpacing = '3px'
  context.fillText('A PRIVATE RECORD MADE FROM A TRUE STORY', 88, 1272)
  context.fillStyle = result.mood.accent
  context.font = '600 24px "DM Sans", sans-serif'
  context.fillText('XIYIN  /  叙音', 820, 1272)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Unable to create story poster'))
    }, 'image/png')
  })
}

export function prepareAlbumAssets(result: SongResult): Promise<AlbumAssets> {
  const cached = assetCache.get(result.id)
  if (cached) return cached
  const preparation = Promise.all([
    createAlbumCover(result),
    renderSongPreviewWav(result),
  ]).then(async ([cover, audio]) => ({
    cover,
    poster: await createStoryPoster(result, cover),
    audio,
  }))
  assetCache.set(result.id, preparation)
  void preparation.catch(() => assetCache.delete(result.id))
  return preparation
}

export function createShareUrl(result: SongResult) {
  const payload = JSON.stringify({ version: 1, story: result.story })
  const bytes = new TextEncoder().encode(payload)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const token = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('album', token)
  return url.toString()
}

export function readSharedStory() {
  const token = new URL(window.location.href).searchParams.get('album')
  if (!token) return null
  try {
    const normalized = token.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { version?: number; story?: string }
    return payload.version === 1 && typeof payload.story === 'string' ? payload.story.slice(0, 1000) : null
  } catch {
    return null
  }
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '').slice(0, 48) || '叙音作品'
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return
  } catch {
    const input = document.createElement('textarea')
    input.value = value
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    const copied = document.execCommand('copy')
    input.remove()
    if (!copied) throw new Error('Clipboard is not available')
  }
}

export async function shareAlbum(
  result: SongResult,
  assets: AlbumAssets,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const name = safeFilename(result.title)
  const files = [
    new File([assets.cover], `${name}-专辑封面.png`, { type: 'image/png' }),
    new File([assets.poster], `${name}-故事海报.png`, { type: 'image/png' }),
    new File([assets.audio], `${name}-纯音乐.wav`, { type: 'audio/wav' }),
  ]
  const shareData = {
    title: `《${result.title}》· 一张叙音私人唱片`,
    text: `${result.theme}。这段真实生活被做成了一张有封面和专属原声的私人唱片。\n\n${result.story.slice(0, 120)}`,
    url: createShareUrl(result),
    files,
  }

  if (navigator.share && navigator.canShare?.({ files })) {
    try {
      await navigator.share(shareData)
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }

  download(assets.cover, files[0].name)
  download(assets.poster, files[1].name)
  download(assets.audio, files[2].name)
  return 'downloaded'
}

export async function shareAlbumLink(result: SongResult) {
  const url = createShareUrl(result)
  if (navigator.share) {
    try {
      await navigator.share({
        title: `《${result.title}》· 一张叙音私人唱片`,
        text: `${result.theme}。这是一张由真实生活做成的私人唱片。`,
        url,
      })
      return 'shared' as const
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled' as const
    }
  }
  await copyText(url)
  return 'copied' as const
}

export function downloadStoryPoster(result: SongResult, assets: AlbumAssets) {
  download(assets.poster, `${safeFilename(result.title)}-故事海报.png`)
}
