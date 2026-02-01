// RichText 数据处理类
import { UIData } from '@leafer-ui/core'
import type { IRichTextData, IUnitData } from './types'

export class RichTextData extends UIData implements IRichTextData {
  // 存储原始值（支持 IUnitData）
  _letterSpacing: number | IUnitData | undefined
  _lineHeight: number | IUnitData | undefined
  
  /**
   * letterSpacing setter - 支持 number 或 IUnitData
   * 注意：这里不做转换，保留原始值，在渲染时转换为像素
   */
  setLetterSpacing(value: number | IUnitData): void {
    this._letterSpacing = value
  }
  
  /**
   * letterSpacing getter
   */
  get letterSpacing(): number | IUnitData | undefined {
    return this._letterSpacing
  }
  
  /**
   * lineHeight setter - 支持 number 或 IUnitData
   */
  setLineHeight(value: number | IUnitData): void {
    this._lineHeight = value
  }
  
  /**
   * lineHeight getter
   */
  get lineHeight(): number | IUnitData | undefined {
    return this._lineHeight
  }
}
