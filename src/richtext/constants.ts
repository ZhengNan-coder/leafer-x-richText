// RichText 常量

export const RICHTEXT_DEFAULTS = {
  fontSize: 16,
  fontFamily: 'Arial, sans-serif',
  fontWeight: 'normal' as const,
  fill: '#000000',
  italic: false,
  editable: true,
  
  cursorColor: '#000000',
  cursorWidth: 2,
  cursorDelay: 300,
  cursorBlinkSpeed: 0.02,  // 降低闪烁速度（之前是 0.05）
  selectionColor: 'rgba(17, 119, 255, 0.3)',
  
  lineHeight: 1.2
}

// 单词边界正则
export const RE_WORD_BOUNDARY = /[\s\u200B]/
export const RE_NON_WORD = /[^\w\u4e00-\u9fa5]/
