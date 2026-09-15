import { strFromU8, unzipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAlbumArchive } from './shareAlbum'
import { generateSong } from './storyEngine'

describe('album export', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('packages each asset once in a single archive', async () => {
    vi.stubGlobal('window', { location: { href: 'https://example.com/story-to-song/' } })
    const result = generateSong('毕业那天，我和朋友在操场开心地大笑，终于实现了期待很久的愿望。')
    const archive = await createAlbumArchive(result, {
      cover: new Blob(['cover'], { type: 'image/png' }),
      poster: new Blob(['poster'], { type: 'image/png' }),
      audio: new Blob(['audio'], { type: 'audio/wav' }),
    })
    const files = unzipSync(new Uint8Array(await archive.arrayBuffer()))
    const filenames = Object.keys(files)

    expect(archive.type).toBe('application/zip')
    expect(filenames).toHaveLength(4)
    expect(filenames.filter((name) => name.endsWith('-专辑封面.png'))).toHaveLength(1)
    expect(filenames.filter((name) => name.endsWith('-故事海报.png'))).toHaveLength(1)
    expect(filenames.filter((name) => name.endsWith('-纯音乐.wav'))).toHaveLength(1)
    const infoName = filenames.find((name) => name.endsWith('-作品信息.txt'))!
    expect(strFromU8(files[infoName])).toContain('可播放链接：https://example.com/story-to-song/#album=')
  })
})
