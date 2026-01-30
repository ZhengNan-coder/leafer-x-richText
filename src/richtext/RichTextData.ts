// RichText 数据处理类
import { UIData } from '@leafer-ui/core'
import type { IRichTextData } from './types'

export class RichTextData extends UIData implements IRichTextData {
  // 数据属性会通过装饰器自动生成
  // 这里只需要定义空类，或者添加特殊的 set 逻辑
  
  // 如果需要特殊处理，可以添加 setXxx 方法
  // 例如：
  // setText(value: string): void {
  //   this._text = value
  //   // 触发重新布局
  // }
}
