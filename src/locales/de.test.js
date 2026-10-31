import { describe, expect, it } from 'vitest'
import DE from './de'

const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort()

describe('German translations', () => {
  it('keep every {placeholder} of the English text', () => {
    for (const [en, de] of Object.entries(DE)) {
      expect(placeholders(de), en).toEqual(placeholders(en))
    }
  })
})
