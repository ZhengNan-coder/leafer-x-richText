// RichText 常量

export const RICHTEXT_DEFAULTS = {
  // 基础字符样式
  fontSize: 16,
  fontFamily: 'Arial, sans-serif',
  fontWeight: 'normal' as const,
  fill: '#000000',
  italic: false,
  
  // 文本格式
  textCase: 'none' as const,
  textDecoration: 'none' as const,
  
  // 间距
  letterSpacing: 0,
  lineHeight: 1.5,
  
  // 换行与溢出
  textWrap: 'normal' as const,
  textOverflow: 'show' as const,
  
  // 段落属性
  paraIndent: 0,
  paraSpacing: 0,
  textAlign: 'left' as const,
  verticalAlign: 'top' as const,
  autoSizeAlign: true,
  padding: 0,
  
  // 尺寸控制
  autoWidth: true,   // 默认自动宽度
  autoHeight: true,  // 默认自动高度
  
  // 编辑相关
  editable: true,
  cursorColor: '#000000',
  cursorWidth: 2,
  cursorDelay: 300,
  cursorBlinkSpeed: 0.02,
  selectionColor: 'rgba(17, 119, 255, 0.3)'
}

// 单词边界正则
export const RE_WORD_BOUNDARY = /[\s\u200B]/
export const RE_NON_WORD = /[^\w\u4e00-\u9fa5]/
