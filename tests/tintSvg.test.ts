import assert from 'node:assert/strict'
import test from 'node:test'
import { tintSvgDataUri } from '../src/lib/tintSvg'

test('tintSvgDataUri colors implicit fills and outlines while preserving transparent and white fills', () => {
  const svg = '<svg><path/><path fill="none" stroke="#000"/><path fill="#fff" stroke="black"/></svg>'
  const tinted = decodeURIComponent(tintSvgDataUri(svg, '#a04b21').split(',')[1])

  assert.equal(tinted, '<svg fill="#a04b21"><path/><path fill="none" stroke="#a04b21"/><path fill="#fff" stroke="#a04b21"/></svg>')
})
