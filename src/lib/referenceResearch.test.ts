import { describe, expect, it } from 'vitest'
import analysis from '../../research/generated/reference-analysis.json'
import listeningStudy from '../../research/real-song-listening-study.json'
import priors from '../../research/composition-priors.json'
import manifest from '../../research/references/manifest.json'
import type { MoodId } from '../types'
import {
  REFERENCE_CORPUS_METADATA,
  REFERENCE_NGRAM_HASHES,
  REFERENCE_SHAPE_FAMILIARITY,
  REFERENCE_TASTE_PROFILES,
} from './generated/referenceProfiles'

const MOODS: MoodId[] = ['joyful', 'melancholy', 'hopeful', 'tense', 'tender', 'calm', 'nostalgic']

describe('reproducible music reference layer', () => {
  it('pins two CC0 references for every supported emotion', () => {
    expect(manifest.corpus.license).toBe('CC0-1.0')
    expect(manifest.corpus.commit).toMatch(/^[a-f0-9]{40}$/)
    expect(manifest.corpus.licenseSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(manifest.selectionPolicy.usesLyrics).toBe(false)
    expect(manifest.works).toHaveLength(14)

    MOODS.forEach((mood) => {
      expect(manifest.works.filter((work) => work.emotion === mood)).toHaveLength(2)
    })
    manifest.works.forEach((work) => {
      expect(work.composerDied).toBeLessThanOrEqual(manifest.selectionPolicy.composerDeathCutoff)
      expect(work.scoreSha256).toMatch(/^[a-f0-9]{64}$/)
      expect(work.analysisSha256).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  it('keeps released-song listening notes qualitative and outside runtime data', () => {
    expect(listeningStudy.method).toMatchObject({
      usesLyrics: false,
      downloadsAudio: false,
      extractsMelody: false,
      runtimeImported: false,
    })
    expect(listeningStudy.cases.length).toBeGreaterThanOrEqual(10)

    const runtimeData = JSON.stringify({
      metadata: REFERENCE_CORPUS_METADATA,
      profiles: REFERENCE_TASTE_PROFILES,
      exactHashes: REFERENCE_NGRAM_HASHES,
      shapeHashes: REFERENCE_SHAPE_FAMILIARITY,
    })
    listeningStudy.cases.forEach((studyCase) => {
      expect(studyCase.source).toMatch(/^https:\/\//)
      expect(runtimeData).not.toContain(studyCase.work)
    })
  })

  it('keeps generated research output and the runtime module synchronized', () => {
    expect(REFERENCE_CORPUS_METADATA).toMatchObject({
      corpus: analysis.corpus.name,
      release: analysis.corpus.release,
      commit: analysis.corpus.commit,
      license: analysis.corpus.license,
      workCount: analysis.works.length,
      manifestSha256: analysis.manifestSha256,
    })
    expect(REFERENCE_TASTE_PROFILES).toEqual(analysis.profiles)
    expect(REFERENCE_NGRAM_HASHES).toEqual(analysis.referenceNgramHashes)
    expect(REFERENCE_SHAPE_FAMILIARITY).toEqual(analysis.referenceShapeFamiliarity)
    expect(new Set(REFERENCE_NGRAM_HASHES).size).toBe(REFERENCE_NGRAM_HASHES.length)
  })

  it('uses measured observations without replacing authored musical judgment', () => {
    expect(analysis.referenceBlend).toBe(priors.referenceBlend)
    MOODS.forEach((mood) => {
      const profile = REFERENCE_TASTE_PROFILES[mood]
      expect(profile.referenceCount).toBe(2)
      expect(profile.target).not.toEqual(profile.authoredTarget)
      Object.entries(profile.target).forEach(([feature, value]) => {
        const key = feature as keyof typeof profile.target
        const expected = profile.authoredTarget[key] * (1 - priors.referenceBlend)
          + profile.calibratedObservation[key] * priors.referenceBlend
        expect(value).toBeCloseTo(expected, 3)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      })
    })
  })
})
