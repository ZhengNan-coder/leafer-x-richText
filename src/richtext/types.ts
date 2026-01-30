// RichText 类型定义
import type { IUIInputData, IUIData, IFontWeight } from '@leafer-ui/interface'

/**
 * 字符样式
 */
export interface ICharStyle {
  fill?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: IFontWeight
  italic?: boolean
  underline?: boolean
  linethrough?: boolean
  textBackgroundColor?: string
}

/**
 * 字符位置信息
 */
export interface ICharMetrics {
  char: string
  x: number
  width: number
  style: ICharStyle
}

/**
 * 行信息
 */
export interface ILineMetrics {
  chars: ICharMetrics[]
  y: number
  height: number
}

/**
 * RichText 输入数据
 */
export interface IRichTextInputData extends IUIInputData {
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: IFontWeight
  fill?: string
  italic?: boolean
  editable?: boolean
  width?: number
  
  // 字符级样式（推荐格式：range-based，简洁）
  styleRanges?: IStyleRange[]
  
  // 兼容旧格式（index-based）
  styles?: any
  
  // 编辑相关
  cursorColor?: string
  cursorWidth?: number
  selectionColor?: string
  
  // 回调（可选，避免 emit 问题）
  onEditingEntered?: () => void
  onEditingExited?: () => void
}

/**
 * RichText 数据
 */
export interface IRichTextData extends IUIData {
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: IFontWeight
  fill?: string
  italic?: boolean
  editable?: boolean
  width?: number
  
  // 字符级样式
  styles?: any
  
  cursorColor?: string
  cursorWidth?: number
  selectionColor?: string
}

/**
 * 样式映射：lineIndex -> charIndex -> style（内部使用）
 */
export type StyleMap = Map<number, Map<number, ICharStyle>>

/**
 * 样式范围（导入导出格式，兼容 Figma）
 */
export interface IStyleRange {
  start: number
  end: number
  fontSize?: number
  fontFamily?: string
  fontWeight?: IFontWeight
  fill?: string
  italic?: boolean
  underline?: boolean
  linethrough?: boolean
  textBackgroundColor?: string
}

/**
 * 光标位置
 */
export interface ICursorLocation {
  lineIndex: number
  charIndex: number
}
