import assert from 'node:assert/strict'
import test from 'node:test'
import { hitPointGainForLevel } from '../src/lib/experience'

test('level-up hit points use the rounded-up class-die average and Constitution modifier', () => {
  assert.equal(hitPointGainForLevel(8, 1), 6)
  assert.equal(hitPointGainForLevel(10, -2), 4)
})

test('manual die results include Constitution and never grant fewer than one hit point', () => {
  assert.equal(hitPointGainForLevel(8, 2, 7), 9)
  assert.equal(hitPointGainForLevel(6, -3, 2), 1)
})
