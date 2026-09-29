export function tintSvgDataUri(svg: string, color: string) {
  const recolorPaint = (paint: string) => /^#(?:fff|ffffff|ffffffff)$/i.test(paint) ? paint : color
  const recoloredSvg = svg
    .replace(/((?:fill|stroke)\s*:\s*)(#[\da-f]{3,8}|black)\b/gi, (_match, prefix: string, paint: string) => `${prefix}${recolorPaint(paint)}`)
    .replace(/((?:fill|stroke)\s*=\s*["'])(#[\da-f]{3,8}|black)(["'])/gi, (_match, prefix: string, paint: string, suffix: string) => `${prefix}${recolorPaint(paint)}${suffix}`)
    .replace(/<svg\b[^>]*>/i, (root) => /\bfill\s*=/.test(root) ? root : root.replace(/>$/, ` fill="${color}">`))

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(recoloredSvg)}`
}
