import { describe, expect, it } from 'vitest'
import { safeUrl } from './format'

describe('safeUrl', () => {
  it('aceita http e https', () => {
    expect(safeUrl('https://www.behance.net/gallery/1')).toBe('https://www.behance.net/gallery/1')
    expect(safeUrl('http://exemplo.com')).toBe('http://exemplo.com/')
  })

  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://exemplo.com', 'exemplo.com', '', null, undefined])(
    'rejeita %s',
    (value) => {
      expect(safeUrl(value as string | null | undefined)).toBeNull()
    },
  )
})
