// RichText 类型定义
import type { 
  IUIInputData, 
  IUIData, 
  IFontWeight,
  ITextCase,
  ITextDecoration,
  ITextDecorationType,
  ITextDecorationData,
  IUnitData,
  ITextWrap,
  IOverflow,
  ITextAlign,
  IVerticalAlign,
  IFill,
  IColor
} from 'leafer-ui'

// 重新导出类型供外部使用
export type {
  ITextCase,
  ITextDecoration,
  ITextDecorationType,
  ITextDecorationData,
  IUnitData,
  ITextWrap,
  IOverflow,
  ITextAlign,
  IVerticalAlign
}

/**
 * 字符样式（支持字符级设置）
 * 注意：lineHeight、textWrap、textOverflow 等段落属性不在此列
 */
export interface ICharStyle {
  // 基础样式
  fill?: IFill  // 与 Leafer 对齐：支持纯色、渐变、图像
  fontSize?: number
  fontFamily?: string
  fontWeight?: IFontWeight
  italic?: boolean
  
  // 文本格式
  textCase?: ITextCase
  textDecoration?: ITextDecoration
  
  // 间距（仅字间距，行高是段落属性）
  letterSpacing?: number | IUnitData
  
  // 背景
  textBackgroundColor?: string
  
  // 兼容旧属性（内部转换为 textDecoration）
  underline?: boolean
  linethrough?: boolean
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
  
  // 基础字符样式
  fontSize?: number
  fontFamily?: string
  fontWeight?: IFontWeight
  fill?: IFill  // 与 Leafer 对齐
  italic?: boolean
  
  // 文本格式
  textCase?: ITextCase
  textDecoration?: ITextDecoration
  
  // 间距
  letterSpacing?: number | IUnitData
  lineHeight?: number | IUnitData
  
  // 换行与溢出
  textWrap?: ITextWrap
  textOverflow?: IOverflow | string
  
  // 段落属性
  paraIndent?: number
  paraSpacing?: number
  textAlign?: ITextAlign
  verticalAlign?: IVerticalAlign
  autoSizeAlign?: boolean
  padding?: number | number[]
  
  // 尺寸控制
  width?: number
  height?: number
  autoWidth?: boolean  // true: 宽度自动适应内容（不换行）
  autoHeight?: boolean // true: 高度自动适应内容
  
  // 编辑相关
  editable?: boolean
  
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
 * RichText 数据（计算数据）
 * 注意：letterSpacing 和 lineHeight 保持 number | IUnitData 以支持灵活输入
 */
export interface IRichTextData extends IUIData {
  text?: string
  
  // 基础字符样式
  fontSize?: number
  fontFamily?: string
  fontWeight?: IFontWeight
  fill?: IFill  // 与 Leafer 对齐
  italic?: boolean
  
  // 文本格式
  textCase?: ITextCase
  textDecoration?: ITextDecoration
  
  // 间距（支持数字或单位对象）
  letterSpacing?: number | IUnitData
  lineHeight?: number | IUnitData
  
  // 换行与溢出
  textWrap?: ITextWrap
  textOverflow?: IOverflow | string
  
  // 段落属性
  paraIndent?: number
  paraSpacing?: number
  textAlign?: ITextAlign
  verticalAlign?: IVerticalAlign
  autoSizeAlign?: boolean
  padding?: number | number[]
  
  // 尺寸控制
  width?: number
  height?: number
  autoWidth?: boolean
  autoHeight?: boolean
  
  // 编辑相关
  editable?: boolean
  
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
  
  // 基础样式
  fontSize?: number
  fontFamily?: string
  fontWeight?: IFontWeight
  fill?: IFill
  italic?: boolean
  
  // 文本格式
  textCase?: ITextCase
  textDecoration?: ITextDecoration
  
  // 间距
  letterSpacing?: number | IUnitData
  
  // 背景
  textBackgroundColor?: string
  
  // 兼容旧属性
  underline?: boolean
  linethrough?: boolean
}

/**
 * 光标位置
 */
export interface ICursorLocation {
  lineIndex: number
  charIndex: number
}
