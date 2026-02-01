// RichText 主类 - 继承 UI，完全自定义
import { UI, registerUI, dataProcessor, boundsType, surfaceType, dataType } from 'leafer-ui'
import type { 
  ILeaferCanvas,
  ITextCase,
  ITextDecoration,
  ITextWrap,
  IOverflow,
  ITextAlign,
  IVerticalAlign,
  IUnitData,
  IFill
} from 'leafer-ui'
import { RichTextData } from './RichTextData'
import type { 
  IRichTextInputData,
  ICharStyle, 
  ICharMetrics, 
  ILineMetrics, 
  StyleMap, 
  ICursorLocation, 
  IStyleRange
} from './types'
import { RICHTEXT_DEFAULTS, RE_WORD_BOUNDARY } from './constants'
import { graphemeSplit, buildFontString, measureTextWidth } from './utils'
import { EditingManager } from './EditingManager'

@registerUI()
export class RichText extends UI {
  public get __tag() { return 'RichText' }
  
  @dataProcessor(RichTextData)
  declare public __: any  // 使用 any 避免类型冲突（letterSpacing/lineHeight 支持 IUnitData）
  
  // ============ 数据属性（响应式）============
  
  // 文本内容
  @boundsType('')
  declare public text: string
  
  // 基础字符样式
  @boundsType(RICHTEXT_DEFAULTS.fontSize)
  declare public fontSize: number
  
  @boundsType(RICHTEXT_DEFAULTS.fontFamily)
  declare public fontFamily: string
  
  @boundsType(RICHTEXT_DEFAULTS.fontWeight)
  declare public fontWeight: any
  
  @surfaceType(RICHTEXT_DEFAULTS.fill)
  declare public fill: IFill
  
  @boundsType(RICHTEXT_DEFAULTS.italic)
  declare public italic: boolean
  
  // 文本格式
  @surfaceType(RICHTEXT_DEFAULTS.textCase)
  declare public textCase: ITextCase
  
  @surfaceType(RICHTEXT_DEFAULTS.textDecoration)
  declare public textDecoration: ITextDecoration
  
  // 间距
  @boundsType(RICHTEXT_DEFAULTS.letterSpacing)
  declare public letterSpacing: number | IUnitData
  
  @boundsType(RICHTEXT_DEFAULTS.lineHeight)
  declare public lineHeight: number | IUnitData
  
  // 换行与溢出
  @boundsType(RICHTEXT_DEFAULTS.textWrap)
  declare public textWrap: ITextWrap
  
  @boundsType(RICHTEXT_DEFAULTS.textOverflow)
  declare public textOverflow: IOverflow | string
  
  // 段落属性
  @boundsType(RICHTEXT_DEFAULTS.paraIndent)
  declare public paraIndent: number
  
  @boundsType(RICHTEXT_DEFAULTS.paraSpacing)
  declare public paraSpacing: number
  
  @boundsType(RICHTEXT_DEFAULTS.textAlign)
  declare public textAlign: ITextAlign
  
  @boundsType(RICHTEXT_DEFAULTS.verticalAlign)
  declare public verticalAlign: IVerticalAlign
  
  @dataType(RICHTEXT_DEFAULTS.autoSizeAlign)
  declare public autoSizeAlign: boolean
  
  @boundsType(RICHTEXT_DEFAULTS.padding)
  declare public padding: number | number[]
  
  // 尺寸控制
  @boundsType(0)
  declare public width: number
  
  @boundsType(0)
  declare public height: number
  
  @boundsType(RICHTEXT_DEFAULTS.autoWidth)
  declare public autoWidth: boolean
  
  @boundsType(RICHTEXT_DEFAULTS.autoHeight)
  declare public autoHeight: boolean
  
  // 编辑相关
  @boundsType(true)
  declare public editable: boolean
  
  @surfaceType(RICHTEXT_DEFAULTS.cursorColor)
  declare public cursorColor: string
  
  @surfaceType(RICHTEXT_DEFAULTS.cursorWidth)
  declare public cursorWidth: number
  
  @surfaceType(RICHTEXT_DEFAULTS.selectionColor)
  declare public selectionColor: string
  
  // 字符级样式（用于导入/导出 JSON），set 时触发更新以保持响应式
  public get styles(): any {
    return this._serializeStyles()
  }
  
  public set styles(value: any) {
    if (value) {
      this._deserializeStyles(value)
      this.__layout.boxChanged || this.__layout.boxChange()
      this.forceUpdate()
      this.forceRender()
    }
  }
  
  // 编辑状态
  public isEditing = false
  public selectionStart = 0
  public selectionEnd = 0
  
  // 回调函数
  public onEditingEntered?: () => void
  public onEditingExited?: () => void
  
  // 内部数据
  private _graphemes: string[] = []
  private _lines: string[][] = []
  private _lineMetrics: ILineMetrics[] = []
  private _styles: StyleMap = new Map()
  private _hiddenTextarea: HTMLTextAreaElement | null = null
  private _cursorOpacity = 1
  private _cursorTimer: number | null = null
  private _inComposition = false
  private _measureCanvas: HTMLCanvasElement
  private _measureCtx: CanvasRenderingContext2D
  
  // 选区锚点（用于 Shift 扩展选区）
  private _selectionAnchor: number | null = null
  private _isMouseDown = false
  
  // 记录双击位置（用于 Editor 触发 enterEditing 时定位光标）
  private _pendingCursorPosition: number | null = null
  
  // Undo/Redo
  private _undoStack: Array<{ text: string; styles: StyleMap; selection: [number, number] }> = []
  private _redoStack: Array<{ text: string; styles: StyleMap; selection: [number, number] }> = []
  
  // 待应用的线性样式（文本变化过程中的临时存储）
  private _pendingLinearStyles: Map<number, ICharStyle> | null = null
  
  // 标记：避免循环更新
  private _isUpdatingBounds = false
  
  // 调试模式：显示基线和行框
  public debugMode = false
  
  // 保存原始 draggable 状态（进入编辑时临时禁用）
  private _savedDraggable: any
  
  // 翻转标记（width/height 为负时）
  private _isFlippedX = false
  private _isFlippedY = false
  
  constructor(data?: IRichTextInputData) {
    super(data)
    
    // ⚠️ 必须先创建测量 canvas，再处理样式（避免 _splitLinesWithWrap 报错）
    this._measureCanvas = document.createElement('canvas')
    this._measureCtx = this._measureCanvas.getContext('2d')!
    
    // 保存回调
    if (data?.onEditingEntered) this.onEditingEntered = data.onEditingEntered
    if (data?.onEditingExited) this.onEditingExited = data.onEditingExited
    
    // 导入样式数据（支持两种格式）
    if (data?.styleRanges) {
      // 推荐格式：range-based（简洁，兼容 Figma）
      this._loadFromStyleRanges(data.styleRanges)
    } else if (data?.styles) {
      // 兼容格式：index-based（旧格式）
      this._deserializeStyles(data.styles)
    }
    
    // 启用边界框命中检测
    this.hitBox = true
    
    // 指定使用 RichTextEditor 作为内部编辑器
    this.editInner = 'RichTextEditor'
    
    // 绑定事件
    this._bindEvents()
  }
  
  // ============ Leafer 生命周期方法 ============
  
  /**
   * 计算边界（必须实现）
   */
  __updateBoxBounds(): void {
    if (this._isUpdatingBounds) return
    this._isUpdatingBounds = true
    
    this._updateGraphemes()
    this._measureText()
    
    const box = this.__layout.boxBounds
    const computed = this._getTextBounds()
    
    // ✅ 支持负宽高：保存翻转标记，使用绝对值计算
    const wasFlippedX = this._isFlippedX
    const wasFlippedY = this._isFlippedY
    const newFlippedX = !this.autoWidth && this.width < 0
    const newFlippedY = !this.autoHeight && this.height < 0
    
    const flipChanged = wasFlippedX !== newFlippedX || wasFlippedY !== newFlippedY
    
    // 调试：输出翻转状态变化
    if (this.debugMode && flipChanged) {
      console.log(`[RichText] 翻转状态变化: FlipX ${wasFlippedX} → ${newFlippedX}, FlipY ${wasFlippedY} → ${newFlippedY}, width=${this.width}, height=${this.height}`)
    }
    
    this._isFlippedX = newFlippedX
    this._isFlippedY = newFlippedY
    
    // ✅ 翻转状态改变时，强制全局重绘（清除残影）
    if (flipChanged && this.leafer) {
      // 通知 Leafer 整个元素需要重绘（包括翻转前的旧位置）
      this.__layout.renderChanged = true
      this.forceUpdate()
    }
    
    // 宽度：autoWidth 时使用计算值，否则使用绝对值
    let width = this.autoWidth || !this.width || this.width === 0
      ? computed.width
      : Math.abs(this.width)  // 使用绝对值
    
    // 高度：autoHeight 时使用计算值，否则使用绝对值
    let height = this.autoHeight || !this.height || this.height === 0
      ? computed.height
      : Math.abs(this.height)  // 使用绝对值
    
    // ✅ 关键：自动宽高模式下，实时更新 width/height 属性值
    // 这样切换为固定宽高时，值不会丢失
    if (this.autoWidth && computed.width > 0 && this.width !== computed.width) {
      this.__.width = computed.width  // 直接设置到数据层，避免触发 boxChange
    }
    if (this.autoHeight && computed.height > 0 && this.height !== computed.height) {
      this.__.height = computed.height
    }
    
    box.x = 0
    box.y = 0
    box.width = width
    box.height = height
    
    this._isUpdatingBounds = false
  }
  
  /**
   * 更新渲染边界（扩大以支持翻转）
   * Leafer 会调用此方法来决定脏矩形范围
   */
  __updateRenderBounds(): void {
    super.__updateRenderBounds?.()
    
    const box = this.__layout.boxBounds
    const render = this.__layout.renderBounds
    
    // ✅ 关键修复：翻转时扩大渲染边界，确保旧内容被清除
    if (this._isFlippedX || this._isFlippedY) {
      // 翻转时，内容可能渲染在负坐标区域
      // 扩大 renderBounds 以包含翻转前后的所有位置
      const expandX = this._isFlippedX ? box.width : 0
      const expandY = this._isFlippedY ? box.height : 0
      
      render.x = box.x - expandX
      render.y = box.y - expandY
      render.width = box.width + expandX
      render.height = box.height + expandY
    } else {
      // 正常情况：renderBounds = boxBounds
      render.x = box.x
      render.y = box.y
      render.width = box.width
      render.height = box.height
    }
  }
  
  /**
   * 绘制碰撞路径（必须实现）
   */
  __drawHitPath(hitCanvas: ILeaferCanvas): void {
    const { context } = hitCanvas
    const { x, y, width, height } = this.__layout.boxBounds
    
    // boxBounds 已考虑翻转（x/y 可能为负），直接使用
    context.beginPath()
    context.rect(x, y, width, height)
  }
  
  /**
   * 自定义绘制（核心）
   */
  __draw(canvas: ILeaferCanvas): void {
    const ctx = canvas.context as CanvasRenderingContext2D
    
    ctx.save()
    
    // ✅ 关键理解：Leafer 的布局系统已经自动处理了负宽高
    // __layout.boxBounds 始终是正值（绝对值）
    // 元素的 transform 矩阵中已包含翻转（scaleX/scaleY 为负）
    // 所以我们只需要按正常逻辑绘制，不要手动翻转！
    
    // 调试：输出状态
    if (this.debugMode) {
      console.log(`[RichText Draw] width=${this.width}, boxBounds.width=${this.__layout.boxBounds.width}, flipX=${this._isFlippedX}, flipY=${this._isFlippedY}`)
    }
    
    // 1. 绘制选区背景
    if (this.isEditing && this.selectionStart !== this.selectionEnd) {
      this._drawSelection(ctx)
    }
    
    // 2. 绘制文本
    this._drawText(ctx)
    
    // 3. 绘制光标
    if (this.isEditing && this.selectionStart === this.selectionEnd) {
      this._drawCursor(ctx)
    }
    
    ctx.restore()
  }
  
  // ============ 文本测量与布局 ============
  
  private _updateGraphemes(): void {
    const text = String(this.text || '')
    const oldGraphemes = this._graphemes
    this._graphemes = graphemeSplit(text)
    
    // ⚠️ 关键：在重新分行前，确保样式为线性格式
    // 避免换行导致样式丢失（行号/列号会变化）
    const hadStyles = this._styles.size > 0
    
    // 情况1：文本长度未变（只是宽度/换行规则变化）→ 保存现有样式
    if (hadStyles && oldGraphemes.length === this._graphemes.length) {
      // 只在没有 pendingLinearStyles 时才保存（避免覆盖已迁移的样式）
      if (!this._pendingLinearStyles) {
        this._pendingLinearStyles = this._convertStylesToLinear()
      }
    }
    
    // 情况2：没有 pendingLinearStyles，但有现有样式 → 转换以便换行计算
    // （这种情况一般不会出现，因为文本变化时已经通过 _shiftStylesBeforeTextChange 设置了）
    if (!this._pendingLinearStyles && hadStyles) {
      this._pendingLinearStyles = this._convertStylesToLinear()
    }
    
    // 重新分行（可能改变行号/列号）
    // _splitLinesWithWrap 会使用 _pendingLinearStyles 来获取字符样式
    this._lines = this._splitLines()
    
    // 应用样式（转换为新的 2D 坐标）
    if (this._pendingLinearStyles) {
      this._applyPendingStyles()
    }
  }
  
  /**
   * 将 2D 样式 Map 转换为线性样式 Map（用于保存/恢复）
   */
  private _convertStylesToLinear(): Map<number, ICharStyle> {
    const linear = new Map<number, ICharStyle>()
    
    for (const [lineIdx, lineMap] of this._styles.entries()) {
      for (const [charIdx, style] of lineMap.entries()) {
        const linearIndex = this._locationToLinear(lineIdx, charIdx)
        linear.set(linearIndex, style)
      }
    }
    
    return linear
  }
  
  private _splitLines(): string[][] {
    if (!this._graphemes.length) return [[]]
    
    // 如果启用了自动宽度，或 textWrap 是 'none'，或没有设置宽度，只按 \n 分行
    if (this.autoWidth || this.textWrap === 'none' || !this.width || this.width <= 0) {
      return this._splitLinesByNewline()
    }
    
    // 自动换行逻辑（固定宽度 + textWrap 非 none）
    return this._splitLinesWithWrap()
  }
  
  /**
   * 按换行符分行（不考虑宽度）
   */
  private _splitLinesByNewline(): string[][] {
    const lines: string[][] = []
    let currentLine: string[] = []
    
    for (const char of this._graphemes) {
      if (char === '\n') {
        lines.push(currentLine)
        currentLine = []
      } else {
        currentLine.push(char)
      }
    }
    lines.push(currentLine)
    
    return lines.length ? lines : [[]]
  }
  
  /**
   * 带自动换行的分行逻辑
   */
  private _splitLinesWithWrap(): string[][] {
    const lines: string[][] = []
    const paragraphs = this._splitLinesByNewline() // 先按 \n 分段
    
    const padding = this._parsePadding(this.padding)
    
    // ✅ 支持负宽度：使用绝对值计算换行宽度
    const absWidth = Math.abs(this.width)
    const maxWidth = absWidth - padding.left - padding.right
    
    // ✅ 安全检查：宽度太小时退化为按 \n 分行
    if (maxWidth <= 20) {
      return this._splitLinesByNewline()
    }
    
    // 临时保存当前的线性字符索引（用于获取字符级样式）
    let linearCharIndex = 0
    
    for (let paraIdx = 0; paraIdx < paragraphs.length; paraIdx++) {
      const para = paragraphs[paraIdx]
      if (para.length === 0) {
        lines.push([])
        linearCharIndex++  // 换行符
        continue
      }
      
      let currentLine: string[] = []
      let currentWidth = 0
      
      // 首行缩进
      const indent = paraIdx === 0 || (paraIdx > 0 && paragraphs[paraIdx - 1].length === 0) 
        ? this.paraIndent 
        : 0
      
      for (let i = 0; i < para.length; i++) {
        const char = para[i]
        
        // ✅ 关键修复：使用字符实际样式的字号来估算宽度
        const charStyle = this._getStyleAtLinearIndex(linearCharIndex)
        const charFontSize = charStyle?.fontSize || this.fontSize
        const charFontFamily = charStyle?.fontFamily || this.fontFamily
        const charFontWeight = charStyle?.fontWeight || this.fontWeight
        const charItalic = charStyle?.italic || this.italic
        const charLetterSpacing = this._parseLetterSpacing(
          charStyle?.letterSpacing || this.letterSpacing, 
          charFontSize
        )
        
        const charWidth = measureTextWidth(
          this._measureCtx,
          char,
          charFontSize,
          charFontFamily,
          charFontWeight,
          charItalic
        )
        
        // 检查是否需要换行
        if (currentWidth + charWidth > maxWidth - indent && currentLine.length > 0) {
          if (this.textWrap === 'break') {
            // 强制断词换行
            lines.push(currentLine)
            currentLine = [char]
            currentWidth = charWidth + charLetterSpacing
          } else {
            // normal: 尝试在单词边界换行
            const lastSpaceIdx = this._findLastSpace(currentLine)
            if (lastSpaceIdx >= 0) {
              // 在空格处断行
              const beforeSpace = currentLine.slice(0, lastSpaceIdx)
              const afterSpace = currentLine.slice(lastSpaceIdx + 1)
              lines.push(beforeSpace)
              currentLine = [...afterSpace, char]
              // 重新计算当前行宽度
              currentWidth = charWidth + charLetterSpacing
              for (let j = 0; j < afterSpace.length; j++) {
                const afterCharIdx = linearCharIndex - afterSpace.length + j
                const afterCharStyle = this._getStyleAtLinearIndex(afterCharIdx)
                const afterCharWidth = this._estimateCharWidthWithStyle(afterSpace[j], afterCharStyle)
                currentWidth += afterCharWidth
              }
            } else {
              // 没有空格，强制断行
              lines.push(currentLine)
              currentLine = [char]
              currentWidth = charWidth + charLetterSpacing
            }
          }
        } else {
          currentLine.push(char)
          currentWidth += charWidth + charLetterSpacing
        }
        
        linearCharIndex++
      }
      
      if (currentLine.length > 0) {
        lines.push(currentLine)
      }
      
      linearCharIndex++  // 换行符
    }
    
    return lines.length ? lines : [[]]
  }
  
  /**
   * 获取线性索引位置的字符样式（用于换行计算）
   */
  private _getStyleAtLinearIndex(linearIndex: number): ICharStyle | null {
    // 优先从 pendingLinearStyles 获取（这是线性格式的样式）
    if (this._pendingLinearStyles?.has(linearIndex)) {
      return this._pendingLinearStyles.get(linearIndex)!
    }
    
    // 如果没有 pendingLinearStyles，返回 null，使用基础样式
    return null
  }
  
  /**
   * 使用指定样式估算字符宽度
   */
  private _estimateCharWidthWithStyle(char: string, style: ICharStyle | null): number {
    const fontSize = style?.fontSize || this.fontSize
    const fontFamily = style?.fontFamily || this.fontFamily
    const fontWeight = style?.fontWeight || this.fontWeight
    const italic = style?.italic || this.italic
    
    const width = measureTextWidth(
      this._measureCtx,
      char,
      fontSize,
      fontFamily,
      fontWeight,
      italic
    )
    
    const letterSpacing = this._parseLetterSpacing(
      style?.letterSpacing || this.letterSpacing,
      fontSize
    )
    
    return width + letterSpacing
  }
  
  /**
   * 查找行中最后一个空格的索引
   */
  private _findLastSpace(line: string[]): number {
    for (let i = line.length - 1; i >= 0; i--) {
      if (RE_WORD_BOUNDARY.test(line[i])) {
        return i
      }
    }
    return -1
  }
  
  private _measureText(): void {
    this._lineMetrics = []
    
    let y = 0
    
    for (let lineIdx = 0; lineIdx < this._lines.length; lineIdx++) {
      const line = this._lines[lineIdx]
      const chars: ICharMetrics[] = []
      
      // 首行缩进（仅第一行或每段第一行）
      let x = lineIdx === 0 || (lineIdx > 0 && this._lines[lineIdx - 1].length === 0) 
        ? this.paraIndent 
        : 0
      
      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        const char = line[charIdx]
        const style = this._getCharStyle(lineIdx, charIdx)
        
        const width = measureTextWidth(
          this._measureCtx,
          char,
          style.fontSize!,
          style.fontFamily!,
          style.fontWeight,
          style.italic
        )
        
        // 字间距
        const letterSpacing = this._parseLetterSpacing(style.letterSpacing, style.fontSize!)
        
        chars.push({ char, x, width, style })
        x += width + letterSpacing
      }
      
      // Figma 标准：行高基于行内最大字号
      const maxFontSize = chars.length > 0 
        ? Math.max(...chars.map(c => c.style.fontSize!))
        : this.fontSize
      
      // 计算行高（lineHeight 乘以最大字号）
      const lineHeightValue = this._parseLineHeight(this.lineHeight, maxFontSize)
      
      // Figma 行为：lineHeight 包含了字符本身高度 + 上下间距
      // lineHeight = fontSize * ratio (如 fontSize=20, ratio=1.5, lineHeight=30)
      // 上下间距总和 = lineHeight - fontSize = 10
      // 分配：上间距和下间距可以不对称，但这里简化为对称分配
      
      this._lineMetrics.push({ chars, y, height: lineHeightValue })
      
      // 段落间距（空行后添加）
      y += lineHeightValue
      if (line.length === 0 && lineIdx < this._lines.length - 1) {
        y += this.paraSpacing
      }
    }
    
    // 应用文本对齐（调整字符 x 坐标）
    this._applyTextAlignToMetrics()
  }
  
  /**
   * 应用文本对齐到字符位置（两端对齐需要调整字符间距）
   */
  private _applyTextAlignToMetrics(): void {
    const padding = this._parsePadding(this.padding)
    const containerWidth = this.autoWidth 
      ? 0 
      : (this.width || 0) - padding.left - padding.right
    
    if (!containerWidth || containerWidth <= 0) return
    
    for (let lineIdx = 0; lineIdx < this._lineMetrics.length; lineIdx++) {
      const line = this._lineMetrics[lineIdx]
      if (!line.chars.length) continue
      
      const { alignOffset, extraSpacing } = this._getAlignOffsetAndSpacing(line, lineIdx)
      
      // 应用对齐偏移和两端对齐间距
      if (alignOffset !== 0 || extraSpacing !== 0) {
        let cumulativeSpacing = 0
        for (let i = 0; i < line.chars.length; i++) {
          line.chars[i].x += alignOffset + cumulativeSpacing
          cumulativeSpacing += extraSpacing
        }
      }
    }
  }
  
  /**
   * 解析 lineHeight（数字或百分比）
   */
  private _parseLineHeight(lineHeight: number | IUnitData, fontSize: number): number {
    if (typeof lineHeight === 'number') {
      return fontSize * lineHeight
    }
    if (lineHeight.type === 'percent') {
      return fontSize * lineHeight.value
    }
    return lineHeight.value // px
  }
  
  /**
   * 解析 letterSpacing（数字或百分比）
   */
  private _parseLetterSpacing(letterSpacing: number | IUnitData | undefined, fontSize: number): number {
    if (!letterSpacing) return 0
    if (typeof letterSpacing === 'number') {
      return letterSpacing
    }
    if (letterSpacing.type === 'percent') {
      return fontSize * letterSpacing.value
    }
    return letterSpacing.value // px
  }
  
  private _getTextBounds(): { width: number; height: number } {
    const padding = this._parsePadding(this.padding)
    
    if (!this._lineMetrics.length) {
      const baseHeight = this.fontSize * (typeof this.lineHeight === 'number' ? this.lineHeight : RICHTEXT_DEFAULTS.lineHeight)
      // ✅ 使用绝对值（支持负宽度）
      const baseWidth = this.autoWidth ? 100 : Math.abs(this.width || 100)
      return { 
        width: baseWidth + padding.left + padding.right, 
        height: baseHeight + padding.top + padding.bottom 
      }
    }
    
    // 计算内容实际宽度
    const contentWidth = Math.max(
      ...this._lineMetrics.map(line => {
        if (!line.chars.length) return 0
        const lastChar = line.chars[line.chars.length - 1]
        const letterSpacing = this._parseLetterSpacing(lastChar.style.letterSpacing, lastChar.style.fontSize!)
        return lastChar.x + lastChar.width + letterSpacing
      }),
      0
    )
    
    // ✅ 宽度：使用绝对值（支持负宽度）
    const finalWidth = this.autoWidth 
      ? contentWidth 
      : Math.max(contentWidth, Math.abs(this.width || 0))
    
    const totalHeight = this._lineMetrics.reduce((sum, line) => sum + line.height, 0)
    
    return { 
      width: finalWidth + padding.left + padding.right || 100, 
      height: totalHeight + padding.top + padding.bottom || this.fontSize * RICHTEXT_DEFAULTS.lineHeight 
    }
  }
  
  // ============ 样式管理 ============
  
  private _getCharStyle(lineIdx: number, charIdx: number): ICharStyle {
    const lineStyles = this._styles.get(lineIdx)
    const charStyle = lineStyles?.get(charIdx) || {}
    
    // 基础样式（从元素属性获取默认值，字符级样式可覆盖）
    const result: ICharStyle = {
      fill: this.fill,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fontWeight: this.fontWeight as any,
      italic: this.italic,
      textCase: this.textCase,
      textDecoration: this.textDecoration,
      letterSpacing: this.letterSpacing,
      ...charStyle
    }
    
    return result
  }
  
  public setSelectionStyles(style: Partial<ICharStyle>): void {
    if (this.selectionStart === this.selectionEnd) return
    
    this._recordSnapshot()
    
    // 确保文本已分割
    if (!this._graphemes.length || !this._lines.length) {
      this._updateGraphemes()
    }
    
    for (let i = this.selectionStart; i < this.selectionEnd; i++) {
      const { lineIndex, charIndex } = this._linearToLocation(i)
      
      if (!this._styles.has(lineIndex)) {
        this._styles.set(lineIndex, new Map())
      }
      
      const lineStyles = this._styles.get(lineIndex)!
      const existing = lineStyles.get(charIndex) || {}
      lineStyles.set(charIndex, { ...existing, ...style })
    }
    
    this._measureText()
    this.forceUpdate()
    this.forceRender()
  }
  
  // ============ 坐标转换 ============
  
  private _linearToLocation(index: number): ICursorLocation {
    if (!this._lines.length) return { lineIndex: 0, charIndex: 0 }
    
    let charCount = 0
    
    for (let lineIndex = 0; lineIndex < this._lines.length; lineIndex++) {
      const lineLength = this._lines[lineIndex].length
      if (index <= charCount + lineLength) {
        return { lineIndex, charIndex: index - charCount }
      }
      charCount += lineLength + 1 // +1 for newline
    }
    
    return { lineIndex: this._lines.length - 1, charIndex: this._lines[this._lines.length - 1]?.length || 0 }
  }
  
  private _locationToLinear(lineIndex: number, charIndex: number): number {
    let index = 0
    for (let i = 0; i < lineIndex && i < this._lines.length; i++) {
      index += this._lines[i].length + 1
    }
    return index + charIndex
  }
  
  private _pointerToIndex(x: number, y: number): number {
    if (!this._lineMetrics.length) return 0
    
    // ✅ 关键：Leafer 的 getInnerPoint() 已经考虑了元素的 transform
    // 包括负宽高导致的翻转（scaleX/scaleY），所以我们不需要手动翻转坐标
    // 直接使用传入的 x, y 即可
    
    // 调试：输出点击坐标
    if (this.debugMode) {
      console.log(`[RichText] _pointerToIndex: x=${x}, y=${y}, flipX=${this._isFlippedX}`)
    }
    
    // 获取 padding
    const padding = this._parsePadding(this.padding)
    const adjustedX = x - padding.left
    const adjustedY = y - padding.top
    
    // 找到对应的行
    let lineIndex = 0
    for (let i = 0; i < this._lineMetrics.length; i++) {
      const line = this._lineMetrics[i]
      if (adjustedY >= line.y && adjustedY < line.y + line.height) {
        lineIndex = i
        break
      }
      if (adjustedY >= line.y + line.height) lineIndex = i
    }
    
    lineIndex = Math.max(0, Math.min(lineIndex, this._lineMetrics.length - 1))
    const line = this._lineMetrics[lineIndex]
    if (!line) return 0
    
    // 在行内找字符（字符位置已包含对齐偏移）
    let charIndex = 0
    if (line.chars.length === 0) {
      charIndex = 0
    } else {
      for (let i = 0; i < line.chars.length; i++) {
        const char = line.chars[i]
        if (adjustedX < char.x + char.width / 2) {
          charIndex = i
          break
        }
        charIndex = i + 1
      }
    }
    
    return this._locationToLinear(lineIndex, charIndex)
  }
  
  // ============ 渲染方法 ============
  
  private _drawText(ctx: CanvasRenderingContext2D): void {
    // 获取 padding（支持数组）
    const padding = this._parsePadding(this.padding)
    
    // 检查是否需要处理溢出（使用绝对值）
    const shouldClip = this.textOverflow === 'hide' || (typeof this.textOverflow === 'string' && this.textOverflow !== 'show')
    const hasFixedSize = (this.width && Math.abs(this.width) > 0 && !this.autoWidth) || (this.height && Math.abs(this.height) > 0 && !this.autoHeight)
    
    if (shouldClip && hasFixedSize) {
      ctx.save()
      // 裁剪到内容区域
      const { width, height } = this.__layout.boxBounds
      ctx.beginPath()
      ctx.rect(0, 0, width, height)
      ctx.clip()
    }
    
    for (let lineIdx = 0; lineIdx < this._lineMetrics.length; lineIdx++) {
      const line = this._lineMetrics[lineIdx]
      
      // ✅ Figma 标准：计算行的统一基线位置（所有字符共享，无论字号大小）
      const maxFontSize = line.chars.length > 0
        ? Math.max(...line.chars.map(c => c.style.fontSize!))
        : this.fontSize
      
      // Figma 行为：lineHeight 产生的额外空间上下均分
      // 例如：fontSize=24, lineHeight=1.8, 实际行高=43.2
      // 额外空间 = 43.2 - 24 = 19.2
      // 上间距 = 19.2 / 2 = 9.6
      // 基线 = 行顶部 + 上间距 + ascent
      const leading = line.height - maxFontSize  // 额外空间（leading）
      const topSpacing = leading / 2  // 上间距
      const ascent = maxFontSize * 0.85  // 字符的 ascent 部分
      const baseline = line.y + topSpacing + ascent  // 共享基线
      
      // 调试模式：绘制基线和行框
      if (this.debugMode) {
        ctx.save()
        
        // 绘制行框
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'
        ctx.lineWidth = 1
        ctx.strokeRect(padding.left, line.y + padding.top, 500, line.height)
        
        // 绘制基线
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(padding.left, baseline + padding.top)
        ctx.lineTo(padding.left + 500, baseline + padding.top)
        ctx.stroke()
        
        // 绘制上间距标记
        ctx.fillStyle = 'rgba(255, 255, 0, 0.2)'
        ctx.fillRect(padding.left, line.y + padding.top, 10, topSpacing)
        
        // 绘制 ascent 区域标记
        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)'
        ctx.fillRect(padding.left, line.y + topSpacing + padding.top, 10, ascent)
        
        ctx.restore()
      }
      
      for (let charIdx = 0; charIdx < line.chars.length; charIdx++) {
        const char = line.chars[charIdx]
        const { x, style } = char
        
        // 字符位置已在 _measureText 中计算好（包含对齐和两端对齐）
        const finalX = x + padding.left
        
        // ✅ Figma 标准：所有字符使用相同的基线，不做偏移
        // 小字和大字都对齐在同一基线上，小字的顶部会比大字高
        const finalY = baseline + padding.top
        
        ctx.save()
        
        // 背景色（需要根据字符实际高度计算）
        if (style.textBackgroundColor) {
          // 背景高度使用字符自身的字号计算
          const charAscent = style.fontSize! * 0.85
          const charDescent = style.fontSize! * 0.15
          const bgY = baseline - charAscent  // 字符顶部（相对于基线）
          const bgHeight = charAscent + charDescent  // 字符总高度
          
          ctx.fillStyle = style.textBackgroundColor
          ctx.fillRect(finalX, bgY + padding.top, char.width, bgHeight)
        }
        
        // 应用 textCase
        let displayChar = this._applyTextCase(char.char, style.textCase)
        
        // 文字
        ctx.fillStyle = this._fillToString(style.fill)
        ctx.font = buildFontString(
          style.fontSize!,
          style.fontFamily!,
          style.fontWeight,
          style.italic
        )
        ctx.fillText(displayChar, finalX, finalY)
        
        // 绘制装饰线（textDecoration 或兼容旧的 underline/linethrough）
        this._drawTextDecoration(ctx, style, finalX, finalY, char.width, line.height)
        
        ctx.restore()
      }
    }
    
    if (shouldClip && hasFixedSize) {
      // 如果是自定义省略符（如 '...'），绘制在右下角
      if (typeof this.textOverflow === 'string' && this.textOverflow !== 'show' && this.textOverflow !== 'hide') {
        const { width, height } = this.__layout.boxBounds
        ctx.fillStyle = this._fillToString(this.fill)
        ctx.font = buildFontString(this.fontSize, this.fontFamily, this.fontWeight, this.italic)
        ctx.fillText(this.textOverflow, width - 30, height - 5)
      }
      ctx.restore()
    }
  }
  
  /**
   * 应用文本大小写转换
   */
  private _applyTextCase(char: string, textCase: ITextCase | undefined): string {
    if (!textCase || textCase === 'none') return char
    
    switch (textCase) {
      case 'upper':
        return char.toUpperCase()
      case 'lower':
        return char.toLowerCase()
      case 'title':
        // title 需要在词首大写，这里简化处理
        return char.toUpperCase()
      default:
        return char
    }
  }
  
  /**
   * 绘制文本装饰线（下划线、删除线）
   * @param y 基线位置
   * @param style 字符样式
   */
  private _drawTextDecoration(
    ctx: CanvasRenderingContext2D, 
    style: ICharStyle, 
    x: number, 
    y: number, 
    width: number, 
    _lineHeight: number
  ): void {
    // 优先使用新的 textDecoration，兼容旧的 underline/linethrough
    let decoration = style.textDecoration
    let decorationColor: string = this._fillToString(style.fill)
    let decorationOffset = 0
    
    // 兼容旧属性
    if (!decoration && (style.underline || style.linethrough)) {
      if (style.underline && style.linethrough) {
        decoration = 'under-delete'
      } else if (style.underline) {
        decoration = 'under'
      } else {
        decoration = 'delete'
      }
    }
    
    if (!decoration || decoration === 'none') return
    
    // 解析 textDecoration
    if (typeof decoration === 'object') {
      decorationColor = this._colorToString(decoration.color) || decorationColor
      decorationOffset = decoration.offset || 0
      decoration = decoration.type
    }
    
    ctx.strokeStyle = decorationColor
    ctx.lineWidth = 1
    
    // 下划线（基线下方）
    if (decoration === 'under' || decoration === 'under-delete') {
      // Figma 标准：下划线在基线下方约 2px，可通过 offset 调整
      const underlineY = y + 2 + decorationOffset
      ctx.beginPath()
      ctx.moveTo(x, underlineY)
      ctx.lineTo(x + width, underlineY)
      ctx.stroke()
    }
    
    // 删除线（字符中部）
    if (decoration === 'delete' || decoration === 'under-delete') {
      // Figma 标准：删除线在字符高度的中部
      // 中部 = 基线 - (fontSize * 0.35) 约为字符高度的中间位置
      const deleteY = y - (style.fontSize! * 0.35)
      ctx.beginPath()
      ctx.moveTo(x, deleteY)
      ctx.lineTo(x + width, deleteY)
      ctx.stroke()
    }
  }
  
  /**
   * 将 IColor 转换为 CSS 颜色字符串
   */
  private _colorToString(color: any): string | undefined {
    if (!color) return undefined
    if (typeof color === 'string') return color
    // 处理 RGB/RGBA 对象
    if (typeof color === 'object') {
      if ('r' in color && 'g' in color && 'b' in color) {
        const a = 'a' in color ? color.a : 1
        return `rgba(${color.r}, ${color.g}, ${color.b}, ${a})`
      }
    }
    return String(color)
  }
  
  /**
   * 将 IFill 转换为 CSS 颜色字符串（简化处理）
   * 完整支持：纯色字符串
   * 简化支持：纯色对象（ISolidPaint）
   * 暂不支持：渐变、图像（降级为默认色）
   */
  private _fillToString(fill: IFill | undefined): string {
    if (!fill) return '#000'
    
    // 字符串：直接使用
    if (typeof fill === 'string') return fill
    
    // 数组：取第一个（简化处理）
    if (Array.isArray(fill)) {
      return this._fillToString(fill[0])
    }
    
    // 对象：检查类型
    if (typeof fill === 'object') {
      // 纯色填充
      if ('type' in fill && fill.type === 'solid' && 'value' in fill) {
        return this._colorToString(fill.value) || '#000'
      }
      
      // 渐变、图像等暂不支持（降级为默认色）
      console.warn('[RichText] 暂不支持渐变/图像填充，降级为默认色')
      return '#000'
    }
    
    return '#000'
  }
  
  /**
   * 获取文本对齐偏移和两端对齐的额外间距
   */
  private _getAlignOffsetAndSpacing(line: ILineMetrics, lineIdx: number): { alignOffset: number; extraSpacing: number } {
    if (!line.chars.length) return { alignOffset: 0, extraSpacing: 0 }
    
    // 计算行的实际宽度（包括最后一个字符的字间距）
    const lastChar = line.chars[line.chars.length - 1]
    const lastLetterSpacing = this._parseLetterSpacing(lastChar.style.letterSpacing, lastChar.style.fontSize!)
    const lineWidth = lastChar.x + lastChar.width + lastLetterSpacing
    
    // 容器宽度（考虑 padding，使用绝对值）
    const padding = this._parsePadding(this.padding)
    const containerWidth = this.autoWidth 
      ? lineWidth 
      : (Math.abs(this.width) || lineWidth) - padding.left - padding.right
    
    const gap = containerWidth - lineWidth
    
    switch (this.textAlign) {
      case 'center':
        return { alignOffset: gap / 2, extraSpacing: 0 }
      
      case 'right':
        return { alignOffset: gap, extraSpacing: 0 }
      
      case 'justify':
      case 'justify-letter':
        // 两端对齐（最后一行除外）
        if (lineIdx < this._lines.length - 1 && line.chars.length > 1 && gap > 0) {
          // 将额外空间均分到字符间隔中
          const extraSpacing = gap / (line.chars.length - 1)
          return { alignOffset: 0, extraSpacing }
        }
        return { alignOffset: 0, extraSpacing: 0 }
      
      case 'both':
      case 'both-letter':
        // 强制两端对齐（包括最后一行）
        if (line.chars.length > 1 && gap > 0) {
          const extraSpacing = gap / (line.chars.length - 1)
          return { alignOffset: 0, extraSpacing }
        }
        return { alignOffset: 0, extraSpacing: 0 }
      
      default:
        return { alignOffset: 0, extraSpacing: 0 }
    }
  }
  
  /**
   * 解析 padding（支持数字或数组）
   */
  private _parsePadding(padding: number | number[] | undefined): { top: number; right: number; bottom: number; left: number } {
    if (!padding) return { top: 0, right: 0, bottom: 0, left: 0 }
    
    if (typeof padding === 'number') {
      return { top: padding, right: padding, bottom: padding, left: padding }
    }
    
    if (padding.length === 1) {
      return { top: padding[0], right: padding[0], bottom: padding[0], left: padding[0] }
    }
    if (padding.length === 2) {
      return { top: padding[0], right: padding[1], bottom: padding[0], left: padding[1] }
    }
    if (padding.length === 3) {
      return { top: padding[0], right: padding[1], bottom: padding[2], left: padding[1] }
    }
    return { top: padding[0], right: padding[1], bottom: padding[2], left: padding[3] }
  }
  
  private _drawSelection(ctx: CanvasRenderingContext2D): void {
    const start = this._linearToLocation(this.selectionStart)
    const end = this._linearToLocation(this.selectionEnd)
    
    const padding = this._parsePadding(this.padding)
    ctx.fillStyle = this.selectionColor
    
    for (let lineIdx = start.lineIndex; lineIdx <= end.lineIndex; lineIdx++) {
      const line = this._lineMetrics[lineIdx]
      if (!line) continue
      
      const startChar = lineIdx === start.lineIndex ? start.charIndex : 0
      const endChar = lineIdx === end.lineIndex ? end.charIndex : line.chars.length
      
      let x1 = 0
      let x2 = 0
      
      if (line.chars.length === 0) {
        // 空行
        x1 = 0
        x2 = 10 // 最小宽度
      } else if (startChar >= line.chars.length) {
        // 行尾
        const lastChar = line.chars[line.chars.length - 1]
        const letterSpacing = this._parseLetterSpacing(lastChar.style.letterSpacing, lastChar.style.fontSize!)
        x1 = lastChar.x + lastChar.width + letterSpacing
        x2 = x1 + 10
      } else {
        x1 = line.chars[startChar]?.x || 0
        if (endChar === 0) {
          x2 = 0
        } else if (endChar >= line.chars.length) {
          const lastChar = line.chars[line.chars.length - 1]
          const letterSpacing = this._parseLetterSpacing(lastChar.style.letterSpacing, lastChar.style.fontSize!)
          x2 = lastChar.x + lastChar.width + letterSpacing
        } else {
          x2 = line.chars[endChar]?.x || x1
        }
      }
      
      if (x2 > x1) {
        // 字符位置已包含对齐偏移，只需加 padding
        const finalX1 = x1 + padding.left
        const finalY = line.y + padding.top
        ctx.fillRect(finalX1, finalY, x2 - x1, line.height)
      }
    }
  }
  
  private _drawCursor(ctx: CanvasRenderingContext2D): void {
    const loc = this._linearToLocation(this.selectionStart)
    const line = this._lineMetrics[loc.lineIndex]
    if (!line) return
    
    // 获取 padding
    const padding = this._parsePadding(this.padding)
    
    let x = 0
    if (line.chars.length === 0 || loc.charIndex === 0) {
      // 空行或行首
      x = loc.charIndex === 0 && line.chars.length > 0 ? line.chars[0].x : 0
    } else if (loc.charIndex >= line.chars.length) {
      // 行尾
      const lastChar = line.chars[line.chars.length - 1]
      const letterSpacing = this._parseLetterSpacing(lastChar.style.letterSpacing, lastChar.style.fontSize!)
      x = lastChar.x + lastChar.width + letterSpacing
    } else {
      x = line.chars[loc.charIndex].x
    }
    
    // 字符位置已包含对齐偏移，只需加 padding
    const finalX = x + padding.left
    const finalY = line.y + padding.top
    
    ctx.globalAlpha = this._cursorOpacity
    ctx.fillStyle = this.cursorColor
    ctx.fillRect(finalX, finalY, this.cursorWidth, line.height)
  }
  
  // ============ 事件绑定 ============
  
  private _bindEvents(): void {
    // 注意：使用 Editor 时，点击事件由 Editor 管理
    // 我们需要监听 double_tap 来记录位置，在 Editor 触发 enterEditing 前
    
    this.on('double_tap', (e: any) => {
      const point = this.getInnerPoint(e)
      const index = this._pointerToIndex(point.x, point.y)
      this._pendingCursorPosition = index
      
      // 如果已经在编辑状态，直接选词
      if (this.isEditing) {
        this._selectWord(index)
      }
    })
    
    this.on('pointer.down', (e: any) => {
      // 只有在已编辑状态才处理
      if (this.isEditing) {
        this._handlePointerDown(e)
      }
    })
    
    this.on('pointer.move', this._handlePointerMove.bind(this))
    this.on('pointer.up', this._handlePointerUp.bind(this))
    
    this.on('tap', (e: any) => {
      if (this.isEditing) {
        this._checkTripleTap(e)
      }
    })
    
    // ✅ 关键：在编辑状态下拦截键盘事件，防止传递到 Editor
    this.on('key.down', (e: any) => {
      if (this.isEditing) {
        // 阻止事件冒泡到 Editor（防止方向键移动元素）
        // Leafer API: 使用 stop() 代替 stopPropagation()
        if (e.stop) e.stop()
      }
    })
    
    this.on('key.up', (e: any) => {
      if (this.isEditing) {
        if (e.stop) e.stop()
      }
    })
  }
  
  /**
   * 公开方法：处理 pointer down（供 RichTextEditor 调用）
   */
  public _handlePointerDown(e: any): void {
    if (!this.editable || !this.isEditing) return
    
    const point = this.getInnerPoint(e)
    const index = this._pointerToIndex(point.x, point.y)
    
    if (e.shiftKey) {
      if (this._selectionAnchor === null) {
        this._selectionAnchor = this.selectionStart
      }
      this.selectionStart = Math.min(this._selectionAnchor, index)
      this.selectionEnd = Math.max(this._selectionAnchor, index)
    } else {
      this._selectionAnchor = index
      this.selectionStart = this.selectionEnd = index
      this._isMouseDown = true
    }
    
    this._updateTextarea()
    this.forceRender()
  }
  
  /**
   * 处理指针移动（公开方法，供 RichTextEditor 调用）
   */
  public _handlePointerMove(e: any): void {
    if (!this._isMouseDown || !this.isEditing) return
    
    const point = this.getInnerPoint(e)
    const index = this._pointerToIndex(point.x, point.y)
    
    if (this._selectionAnchor !== null) {
      this.selectionStart = Math.min(this._selectionAnchor, index)
      this.selectionEnd = Math.max(this._selectionAnchor, index)
    }
    
    this._updateTextarea()
    this.forceRender()
  }
  
  /**
   * 处理指针抬起（公开方法，供 RichTextEditor 调用）
   */
  public _handlePointerUp(_e: any): void {
    this._isMouseDown = false
  }
  
  // 三击选行（监听 tap 事件计数实现）
  private _tapCount = 0
  private _lastTapTime = 0
  
  private _checkTripleTap(e: any): void {
    if (!this.isEditing) return
    
    const now = Date.now()
    if (now - this._lastTapTime < 500) {
      this._tapCount++
    } else {
      this._tapCount = 1
    }
    this._lastTapTime = now
    
    if (this._tapCount === 3) {
      const point = this.getInnerPoint(e)
      const index = this._pointerToIndex(point.x, point.y)
      this._selectLine(index)
    }
  }
  
  // ============ 编辑模式 ============
  
  /**
   * 进入编辑模式
   * @param cursorPosition 可选的初始光标位置（用于双击等场景）
   */
  public enterEditing(cursorPosition?: number): void {
    if (this.isEditing || !this.editable) return
    
    // 确保文本已初始化
    if (!this._graphemes.length && this.text) {
      this._updateGraphemes()
    }
    
    // 通知管理器，退出其他编辑器
    EditingManager.requestEditing(this)
    
    this.isEditing = true
    
    // ✅ 关键：进入编辑时禁用元素拖拽，避免键盘事件移动元素
    // 保存原始 draggable 状态
    this._savedDraggable = (this as any).draggable
    ;(this as any).draggable = false
    
    // 设置光标位置（优先使用参数，其次使用待定位置）
    const targetPosition = cursorPosition !== undefined 
      ? cursorPosition 
      : (this._pendingCursorPosition !== null ? this._pendingCursorPosition : undefined)
    
    if (targetPosition !== undefined) {
      this.selectionStart = this.selectionEnd = Math.max(0, Math.min(targetPosition, this._graphemes.length))
      this._pendingCursorPosition = null
    }
    
    this._createHiddenTextarea()
    this._startCursorBlink()
    
    this.forceRender()
    
    // 触发回调
    if (this.onEditingEntered) {
      this.onEditingEntered()
    }
    
    // 尝试触发 Leafer 事件（可能会失败，不影响功能）
    setTimeout(() => {
      if (this.leafer && this.isEditing) {
        try {
          this.emit('editing:entered' as any)
        } catch (_err) {
          // 忽略 emit 错误，使用回调即可
        }
      }
    }, 0)
  }
  
  public exitEditing(): void {
    if (!this.isEditing) return
    
    this.isEditing = false
    
    // ✅ 恢复原始 draggable 状态
    if (this._savedDraggable !== undefined) {
      ;(this as any).draggable = this._savedDraggable
      this._savedDraggable = undefined
    }
    this._destroyHiddenTextarea()
    this._stopCursorBlink()
    this.selectionStart = this.selectionEnd = 0
    
    // 清除管理器状态
    EditingManager.clearActive(this)
    
    this.forceRender()
    
    // 触发回调
    if (this.onEditingExited) {
      this.onEditingExited()
    }
    
    // 尝试触发 Leafer 事件（可能会失败，不影响功能）
    setTimeout(() => {
      if (this.leafer) {
        try {
          this.emit('editing:exited' as any)
        } catch (_err) {
          // 忽略 emit 错误，使用回调即可
        }
      }
    }, 0)
  }
  
  /**
   * 重新聚焦（用于点击面板后恢复焦点）
   */
  public refocus(): void {
    if (this.isEditing && this._hiddenTextarea) {
      this._hiddenTextarea.focus()
    }
  }
  
  // ============ Hidden Textarea ============
  
  private _createHiddenTextarea(): void {
    if (this._hiddenTextarea) return
    
    const textarea = document.createElement('textarea')
    
    textarea.autocapitalize = 'off'
    textarea.autocomplete = 'off'
    textarea.spellcheck = false
    textarea.setAttribute('data-richtext-editor', 'true')
    textarea.style.cssText = `
      position: fixed;
      top: -9999px;
      left: -9999px;
      opacity: 0;
      width: 1px;
      height: 1px;
      pointer-events: none;
    `
    
    textarea.value = String(this.text || '')
    textarea.selectionStart = this.selectionStart
    textarea.selectionEnd = this.selectionEnd
    
    document.body.appendChild(textarea)
    
    // 事件监听
    textarea.addEventListener('input', this._onInput.bind(this))
    textarea.addEventListener('keydown', this._onKeyDown.bind(this))
    textarea.addEventListener('compositionstart', () => { 
      this._inComposition = true
    })
    textarea.addEventListener('compositionend', () => {
      this._inComposition = false
      this._onInput()
    })
    textarea.addEventListener('blur', () => {
      // blur 时不退出编辑，只重新聚焦；退出由 Editor.closeInnerEditor() 或 ESC 控制
      // 退出编辑由 Editor.closeInnerEditor() 或 ESC 键控制
      setTimeout(() => {
        if (!this.isEditing) return
        if (!this._hiddenTextarea) return
        
        const activeEl = document.activeElement
        
        // 如果焦点在面板元素上，重新聚焦 textarea
        const isUIElement = activeEl && (
          activeEl.closest('.panel') || 
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.tagName === 'BUTTON'
        )
        
        if (isUIElement || activeEl !== this._hiddenTextarea) {
          this._hiddenTextarea?.focus()
        }
      }, 100)
    })
    
    this._hiddenTextarea = textarea
    
    // 延迟聚焦，避免立即 blur
    setTimeout(() => {
      if (this._hiddenTextarea) {
        this._hiddenTextarea.focus()
      }
    }, 0)
  }
  
  private _destroyHiddenTextarea(): void {
    if (this._hiddenTextarea) {
      this._hiddenTextarea.blur()
      this._hiddenTextarea.remove()
      this._hiddenTextarea = null
    }
  }
  
  private _updateTextarea(): void {
    if (!this._hiddenTextarea || this._inComposition) return
    
    this._hiddenTextarea.selectionStart = this.selectionStart
    this._hiddenTextarea.selectionEnd = this.selectionEnd
  }
  
  private _onInput(): void {
    if (!this._hiddenTextarea || this._inComposition) return
    
    const newText = this._hiddenTextarea.value
    const oldText = String(this.text || '')
    
    if (newText === oldText) {
      this.selectionStart = this._hiddenTextarea.selectionStart
      this.selectionEnd = this._hiddenTextarea.selectionEnd
      return
    }
    
    this._recordSnapshot()
    
    // 文本 diff + 样式迁移（参考 Fabric 思路）
    const oldG = this._graphemes
    const newG = graphemeSplit(newText)
    
    // 找出公共前缀
    let prefix = 0
    while (prefix < oldG.length && prefix < newG.length && oldG[prefix] === newG[prefix]) {
      prefix++
    }
    
    // 找出公共后缀
    let suffix = 0
    while (
      suffix < oldG.length - prefix &&
      suffix < newG.length - prefix &&
      oldG[oldG.length - 1 - suffix] === newG[newG.length - 1 - suffix]
    ) {
      suffix++
    }
    
    const removedCount = oldG.length - prefix - suffix
    const insertedCount = newG.length - prefix - suffix
    
    // 先迁移样式（用旧的 _lines），然后再更新 text
    this._shiftStylesBeforeTextChange(prefix, removedCount, insertedCount)
    
    // 更新文本（会触发 _updateGraphemes 和 _splitLines）
    this.text = newText
    this.selectionStart = this._hiddenTextarea.selectionStart
    this.selectionEnd = this._hiddenTextarea.selectionEnd
    
    this.forceUpdate()
    this.forceRender()
  }
  
  /**
   * 样式迁移：插入/删除时调整样式索引（在文本变化前调用）
   */
  private _shiftStylesBeforeTextChange(start: number, removedCount: number, insertedCount: number): void {
    if (removedCount === 0 && insertedCount === 0) return
    
    // 1. 收集旧文本的线性样式（用当前的 _lines）
    const oldLinearStyles = new Map<number, ICharStyle>()
    for (const [lineIdx, lineStyles] of this._styles.entries()) {
      for (const [charIdx, style] of lineStyles.entries()) {
        const linear = this._locationToLinear(lineIdx, charIdx)
        oldLinearStyles.set(linear, { ...style })
      }
    }
    
    // 2. 在线性空间中偏移样式索引
    const newLinearStyles = new Map<number, ICharStyle>()
    const delta = insertedCount - removedCount
    
    for (const [index, style] of oldLinearStyles.entries()) {
      let newIndex: number
      
      if (index < start) {
        // 插入/删除位置之前的样式：不变
        newIndex = index
      } else if (index >= start + removedCount) {
        // 插入/删除位置之后的样式：整体偏移
        newIndex = index + delta
      } else {
        continue
      }
      
      newLinearStyles.set(newIndex, style)
    }
    
    // 3. 插入字符：继承前一字符样式
    if (insertedCount > 0) {
      const refIndex = start > 0 ? start - 1 : (start + removedCount < oldLinearStyles.size ? start + removedCount : -1)
      const refStyle = oldLinearStyles.get(refIndex)
      
      if (refStyle) {
        for (let i = 0; i < insertedCount; i++) {
          newLinearStyles.set(start + i, { ...refStyle })
        }
      }
    }
    
    // 4. 保存为临时线性样式（稍后转换到新的 2D 坐标）
    this._pendingLinearStyles = newLinearStyles
  }
  
  /**
   * 将线性样式转换为 2D 样式（在文本更新后调用）
   */
  private _applyPendingStyles(): void {
    if (!this._pendingLinearStyles) return
    
    const newStyles: StyleMap = new Map()
    
    for (const [linearIndex, style] of this._pendingLinearStyles.entries()) {
      const loc = this._linearToLocation(linearIndex)
      
      if (!newStyles.has(loc.lineIndex)) {
        newStyles.set(loc.lineIndex, new Map())
      }
      newStyles.get(loc.lineIndex)!.set(loc.charIndex, style)
    }
    
    this._styles = newStyles
    this._pendingLinearStyles = null
  }
  
  private _onKeyDown(e: KeyboardEvent): void {
    const isMod = e.ctrlKey || e.metaKey
    
    // 修饰键组合
    if (isMod) {
      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault()
          this.selectAll()
          return
        case 'z':
          e.preventDefault()
          if (e.shiftKey) this.redo()
          else this.undo()
          return
        case 'arrowleft':
          e.preventDefault()
          this._moveByWord(-1, e.shiftKey)
          return
        case 'arrowright':
          e.preventDefault()
          this._moveByWord(1, e.shiftKey)
          return
      }
    }
    
    // 方向键导航
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        this._moveCursor(-1, e.shiftKey)
        break
      case 'ArrowRight':
        e.preventDefault()
        this._moveCursor(1, e.shiftKey)
        break
      case 'ArrowUp':
        e.preventDefault()
        this._moveVertical(-1, e.shiftKey)
        break
      case 'ArrowDown':
        e.preventDefault()
        this._moveVertical(1, e.shiftKey)
        break
      case 'Home':
        e.preventDefault()
        this._moveToLineEnd(true, e.shiftKey)
        break
      case 'End':
        e.preventDefault()
        this._moveToLineEnd(false, e.shiftKey)
        break
      case 'Escape':
        e.preventDefault()
        this.exitEditing()
        break
    }
  }
  
  // ============ 键盘导航 ============
  
  private _moveCursor(direction: -1 | 1, expand: boolean): void {
    let newPos = direction < 0 ? this.selectionStart : this.selectionEnd
    
    if (!expand && this.selectionStart !== this.selectionEnd) {
      this.selectionStart = this.selectionEnd = newPos
      this._selectionAnchor = null
    } else {
      newPos = Math.max(0, Math.min(newPos + direction, this._graphemes.length))
      this._updateSelection(newPos, expand)
    }
    
    this._updateTextarea()
    this.forceRender()
  }
  
  private _moveVertical(direction: -1 | 1, expand: boolean): void {
    const baseIndex = direction < 0 ? this.selectionStart : this.selectionEnd
    const loc = this._linearToLocation(baseIndex)
    const targetLine = Math.max(0, Math.min(loc.lineIndex + direction, this._lines.length - 1))
    
    if (targetLine === loc.lineIndex) return
    
    const targetCharIndex = Math.min(loc.charIndex, this._lines[targetLine].length)
    const newPos = this._locationToLinear(targetLine, targetCharIndex)
    
    this._updateSelection(newPos, expand)
    this._updateTextarea()
    this.forceRender()
  }
  
  private _moveToLineEnd(toStart: boolean, expand: boolean): void {
    const baseIndex = toStart ? this.selectionStart : this.selectionEnd
    const loc = this._linearToLocation(baseIndex)
    const lineStart = this._locationToLinear(loc.lineIndex, 0)
    const lineEnd = lineStart + this._lines[loc.lineIndex].length
    
    this._updateSelection(toStart ? lineStart : lineEnd, expand)
    this._updateTextarea()
    this.forceRender()
  }
  
  private _moveByWord(direction: -1 | 1, expand: boolean): void {
    const baseIndex = direction < 0 ? this.selectionStart : this.selectionEnd
    const text = this._graphemes
    let index = baseIndex
    
    // 跳过空白
    while (index >= 0 && index < text.length && RE_WORD_BOUNDARY.test(text[index])) {
      index += direction
    }
    
    // 跳过单词
    while (index >= 0 && index < text.length && !RE_WORD_BOUNDARY.test(text[index])) {
      index += direction
    }
    
    if (direction === -1 && index >= 0 && RE_WORD_BOUNDARY.test(text[index])) {
      index++
    }
    
    const newPos = Math.max(0, Math.min(index, text.length))
    this._updateSelection(newPos, expand)
    this._updateTextarea()
    this.forceRender()
  }
  
  private _updateSelection(newPos: number, expand: boolean): void {
    if (expand) {
      if (this._selectionAnchor === null) {
        this._selectionAnchor = this.selectionStart
      }
      this.selectionStart = Math.min(this._selectionAnchor, newPos)
      this.selectionEnd = Math.max(this._selectionAnchor, newPos)
    } else {
      this._selectionAnchor = null
      this.selectionStart = this.selectionEnd = newPos
    }
  }
  
  // ============ 选区操作 ============
  
  public selectAll(): void {
    this.selectionStart = 0
    this.selectionEnd = this._graphemes.length
    this._updateTextarea()
    this.forceRender()
  }
  
  private _selectWord(index: number): void {
    const text = this._graphemes
    
    let start = index
    while (start > 0 && !RE_WORD_BOUNDARY.test(text[start - 1])) start--
    
    let end = index
    while (end < text.length && !RE_WORD_BOUNDARY.test(text[end])) end++
    
    this.selectionStart = start
    this.selectionEnd = end
    this._selectionAnchor = null
    this._updateTextarea()
    this.forceRender()
  }
  
  private _selectLine(index: number): void {
    const loc = this._linearToLocation(index)
    const start = this._locationToLinear(loc.lineIndex, 0)
    const end = start + this._lines[loc.lineIndex].length
    
    this.selectionStart = start
    this.selectionEnd = end
    this._selectionAnchor = null
    this._updateTextarea()
    this.forceRender()
  }
  
  // ============ 光标动画 ============
  
  private _startCursorBlink(): void {
    this._stopCursorBlink()
    
    const speed = RICHTEXT_DEFAULTS.cursorBlinkSpeed
    let increasing = false
    
    const blink = () => {
      if (!this.isEditing || this.selectionStart !== this.selectionEnd) {
        this._cursorOpacity = 1
        return
      }
      
      if (increasing) {
        this._cursorOpacity += speed
        if (this._cursorOpacity >= 1) {
          this._cursorOpacity = 1
          increasing = false
        }
      } else {
        this._cursorOpacity -= speed
        if (this._cursorOpacity <= 0) {
          this._cursorOpacity = 0
          increasing = true
        }
      }
      
      this.forceRender()
      this._cursorTimer = requestAnimationFrame(blink) as any
    }
    
    setTimeout(() => {
      this._cursorTimer = requestAnimationFrame(blink) as any
    }, RICHTEXT_DEFAULTS.cursorDelay)
  }
  
  private _stopCursorBlink(): void {
    if (this._cursorTimer) {
      cancelAnimationFrame(this._cursorTimer)
      this._cursorTimer = null
    }
    this._cursorOpacity = 1
  }
  
  // ============ Undo/Redo ============
  
  private _recordSnapshot(): void {
    this._undoStack.push({
      text: String(this.text || ''),
      styles: new Map(this._styles),
      selection: [this.selectionStart, this.selectionEnd]
    })
    this._redoStack = []
  }
  
  public undo(): void {
    const snapshot = this._undoStack.pop()
    if (!snapshot) return
    
    this._redoStack.push({
      text: String(this.text || ''),
      styles: new Map(this._styles),
      selection: [this.selectionStart, this.selectionEnd]
    })
    
    this.text = snapshot.text
    this._styles = snapshot.styles
    this.selectionStart = snapshot.selection[0]
    this.selectionEnd = snapshot.selection[1]
    
    this._updateTextarea()
    this.forceUpdate()
    this.forceRender()
  }
  
  public redo(): void {
    const snapshot = this._redoStack.pop()
    if (!snapshot) return
    
    this._undoStack.push({
      text: String(this.text || ''),
      styles: new Map(this._styles),
      selection: [this.selectionStart, this.selectionEnd]
    })
    
    this.text = snapshot.text
    this._styles = snapshot.styles
    this.selectionStart = snapshot.selection[0]
    this.selectionEnd = snapshot.selection[1]
    
    this._updateTextarea()
    this.forceUpdate()
    this.forceRender()
  }
  
  // ============ 公开 API ============
  
  /**
   * 获取选区文本
   */
  public getSelectedText(): string {
    return this._graphemes.slice(this.selectionStart, this.selectionEnd).join('')
  }
  
  /**
   * 获取选区样式
   */
  public getSelectionStyles(): ICharStyle[] {
    const styles: ICharStyle[] = []
    for (let i = this.selectionStart; i < this.selectionEnd; i++) {
      const loc = this._linearToLocation(i)
      styles.push(this._getCharStyle(loc.lineIndex, loc.charIndex))
    }
    return styles
  }

  /**
   * 获取某一下标处的有效样式（用于未进入编辑时面板展示整段样式）
   */
  public getStyleAt(linearIndex: number): ICharStyle {
    if (!this._lines.length) {
      return {
        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
        fontWeight: this.fontWeight as any,
        fill: this.fill,
        italic: this.italic
      }
    }
    const loc = this._linearToLocation(Math.max(0, Math.min(linearIndex, this._graphemes.length)))
    return this._getCharStyle(loc.lineIndex, loc.charIndex)
  }
  
  /**
   * 清除选区样式
   */
  public clearSelectionStyles(): void {
    if (this.selectionStart === this.selectionEnd) return

    this._recordSnapshot()

    for (let i = this.selectionStart; i < this.selectionEnd; i++) {
      const loc = this._linearToLocation(i)
      const lineStyles = this._styles.get(loc.lineIndex)
      if (lineStyles) {
        lineStyles.delete(loc.charIndex)
      }
    }

    // 重新测量和渲染
    this._measureText()
    this.forceUpdate()
    this.forceRender()
  }

  /**
   * 全量设置整段文本样式（不进入编辑器时面板修改用）
   * 只修改指定的样式属性，保留其他字符级样式
   */
  public setFullTextStyles(styleObj: Partial<ICharStyle>): void {
    this._updateGraphemes()
    this._recordSnapshot()

    // 更新基础样式属性
    if (styleObj.fontSize !== undefined) this.fontSize = styleObj.fontSize
    if (styleObj.fontFamily !== undefined) this.fontFamily = styleObj.fontFamily
    if (styleObj.fontWeight !== undefined) this.fontWeight = styleObj.fontWeight
    if (styleObj.fill !== undefined) this.fill = styleObj.fill
    if (styleObj.italic !== undefined) this.italic = styleObj.italic
    if (styleObj.textCase !== undefined) this.textCase = styleObj.textCase
    if (styleObj.textDecoration !== undefined) this.textDecoration = styleObj.textDecoration
    if (styleObj.letterSpacing !== undefined) this.letterSpacing = styleObj.letterSpacing

    // 遍历所有字符，只更新 styleObj 中指定的属性，保留其他样式
    const len = this._graphemes.length
    for (let i = 0; i < len; i++) {
      const loc = this._linearToLocation(i)
      
      // 确保 Map 结构存在
      if (!this._styles.has(loc.lineIndex)) {
        this._styles.set(loc.lineIndex, new Map())
      }
      
      // 获取现有样式，合并新样式
      const existing = this._styles.get(loc.lineIndex)!.get(loc.charIndex) || {}
      const merged = { ...existing, ...styleObj }
      
      this._styles.get(loc.lineIndex)!.set(loc.charIndex, merged)
    }

    this._measureText()
    this.forceUpdate()
    this.forceRender()
  }

  /**
   * 清除整段文本的字符级样式，全部回退为基础样式
   */
  public clearFullTextStyles(): void {
    this._recordSnapshot()
    this._styles.clear()
    this._measureText()
    this.forceUpdate()
    this.forceRender()
  }
  
  /**
   * 插入文本
   */
  public insertText(text: string, position?: number): void {
    const pos = position ?? this.selectionStart
    
    if (!this._hiddenTextarea) {
      this._recordSnapshot()
      const before = this._graphemes.slice(0, pos)
      const after = this._graphemes.slice(this.selectionEnd)
      this.text = [...before, ...graphemeSplit(text), ...after].join('')
      this.selectionStart = this.selectionEnd = pos + graphemeSplit(text).length
      this.forceUpdate()
      this.forceRender()
    } else {
      const ta = this._hiddenTextarea
      ta.value = ta.value.slice(0, pos) + text + ta.value.slice(this.selectionEnd)
      ta.selectionStart = ta.selectionEnd = pos + graphemeSplit(text).length
      this._onInput()
    }
  }
  
  /**
   * 删除选区
   */
  public deleteSelection(): void {
    if (this.selectionStart === this.selectionEnd) return
    this.insertText('', this.selectionStart)
  }
  
  // ============ JSON 序列化 ============
  
  /**
   * 序列化样式为普通对象（用于导出 JSON）
   */
  private _serializeStyles(): any {
    const result: any = {}
    for (const [lineIdx, lineStyles] of this._styles.entries()) {
      result[lineIdx] = {}
      for (const [charIdx, style] of lineStyles.entries()) {
        result[lineIdx][charIdx] = { ...style }
      }
    }
    return result
  }
  
  /**
   * 反序列化样式（用于从 JSON 导入）
   */
  private _deserializeStyles(data: any): void {
    this._styles.clear()
    
    if (!data || typeof data !== 'object') return
    
    Object.keys(data).forEach(lineKey => {
      const lineIdx = Number(lineKey)
      const lineData = data[lineKey]
      
      if (!lineData || typeof lineData !== 'object') return
      
      const lineStyles = new Map<number, ICharStyle>()
      Object.keys(lineData).forEach(charKey => {
        const charIdx = Number(charKey)
        lineStyles.set(charIdx, { ...lineData[charKey] })
      })
      
      this._styles.set(lineIdx, lineStyles)
    })
  }
  
  /**
   * Range → Index 转换（导入时）
   */
  private _loadFromStyleRanges(ranges: IStyleRange[]): void {
    this._styles.clear()
    
    // 确保文本已分割
    if (!this._graphemes.length && this.text) {
      this._updateGraphemes()
    }
    
    for (const range of ranges) {
      const { start, end, ...style } = range
      
      // 将 range 展开为逐字符样式
      for (let i = start; i < end && i < this._graphemes.length; i++) {
        const loc = this._linearToLocation(i)
        
        if (!this._styles.has(loc.lineIndex)) {
          this._styles.set(loc.lineIndex, new Map())
        }
        
        this._styles.get(loc.lineIndex)!.set(loc.charIndex, { ...style })
      }
    }
  }
  
  /**
   * Index → Range 转换（导出时，压缩格式）
   */
  private _compressToStyleRanges(): IStyleRange[] {
    const ranges: IStyleRange[] = []
    
    // 收集线性样式
    const linearStyles = new Map<number, ICharStyle>()
    for (const [lineIdx, lineStyles] of this._styles.entries()) {
      for (const [charIdx, style] of lineStyles.entries()) {
        const linear = this._locationToLinear(lineIdx, charIdx)
        linearStyles.set(linear, style)
      }
    }
    
    if (linearStyles.size === 0) return ranges
    
    // 按索引排序
    const sortedIndices = Array.from(linearStyles.keys()).sort((a, b) => a - b)
    
    let currentStart = sortedIndices[0]
    let currentStyle = linearStyles.get(currentStart)!
    let lastIndex = currentStart
    
    for (let i = 1; i < sortedIndices.length; i++) {
      const index = sortedIndices[i]
      const style = linearStyles.get(index)!
      
      // 检查是否可以合并（相邻且样式相同）
      const isAdjacent = index === lastIndex + 1
      const isSameStyle = JSON.stringify(style) === JSON.stringify(currentStyle)
      
      if (isAdjacent && isSameStyle) {
        // 继续当前 range
        lastIndex = index
      } else {
        // 结束当前 range，开始新 range
        ranges.push({
          start: currentStart,
          end: lastIndex + 1,
          ...currentStyle
        })
        
        currentStart = index
        currentStyle = style
        lastIndex = index
      }
    }
    
    // 添加最后一个 range
    if (currentStyle) {
      ranges.push({
        start: currentStart,
        end: lastIndex + 1,
        ...currentStyle
      })
    }
    
    return ranges
  }
  
  /**
   * 重写 toJSON，使用 Range-based 格式（兼容 Figma）
   */
  public toJSON(): any {
    const json = super.toJSON()
    
    // ✅ 使用 styleRanges（简洁格式）
    const styleRanges = this._compressToStyleRanges()
    if (styleRanges.length > 0) {
      json.styleRanges = styleRanges
    }
    
    // 移除不需要导出的内部属性
    delete json.hitBox
    delete json.editInner
    delete json.isEditing
    delete json.selectionStart
    delete json.selectionEnd
    delete json.cursorColor
    delete json.cursorWidth
    delete json.selectionColor
    
    return json
  }
}
