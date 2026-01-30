// RichText 工具函数

/**
 * 将字符串分割为 grapheme 数组（处理表情等复杂字符）
 */
export function graphemeSplit(text: string): string[] {
  if (!text) return []
  
  // 使用 Intl.Segmenter (现代浏览器) 或 fallback
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter('en', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), (s: any) => s.segment)
  }
  
  // Fallback: 简单分割
  return Array.from(text)
}

/**
 * 构建字体字符串
 */
export function buildFontString(
  fontSize: number,
  fontFamily: string,
  fontWeight: string | number | undefined = 'normal',
  italic: boolean = false
): string {
  const weight = fontWeight === 'normal' || !fontWeight ? '' : `${fontWeight} `
  const style = italic ? 'italic ' : ''
  return `${style}${weight}${fontSize}px ${fontFamily}`
}

/**
 * 测量文本宽度
 */
export function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: string | number | undefined = 'normal',
  italic: boolean = false
): number {
  ctx.font = buildFontString(fontSize, fontFamily, fontWeight, italic)
  return ctx.measureText(text).width
}
