// RichText 主类 - 继承 UI，完全自定义
import { UI, registerUI, dataProcessor, boundsType, surfaceType } from '@leafer-ui/core'
import type { ILeaferCanvas } from '@leafer-ui/interface'
import { RichTextData } from './RichTextData'
import type { IRichTextInputData, IRichTextData, ICharStyle, ICharMetrics, ILineMetrics, StyleMap, ICursorLocation, IStyleRange } from './types'
import { RICHTEXT_DEFAULTS, RE_WORD_BOUNDARY } from './constants'
import { graphemeSplit, buildFontString, measureTextWidth } from './utils'
import { EditingManager } from './EditingManager'

@registerUI()
export class RichText extends UI {
  public get __tag() { return 'RichText' }
  
  @dataProcessor(RichTextData)
  declare public __: IRichTextData
  
  // 数据属性
  @boundsType('')
  declare public text: string
  
  @boundsType(RICHTEXT_DEFAULTS.fontSize)
  declare public fontSize: number
  
  @boundsType(RICHTEXT_DEFAULTS.fontFamily)
  declare public fontFamily: string
  
  @boundsType(RICHTEXT_DEFAULTS.fontWeight)
  declare public fontWeight: any
  
  @surfaceType(RICHTEXT_DEFAULTS.fill)
  declare public fill: string
  
  @boundsType(RICHTEXT_DEFAULTS.italic)
  declare public italic: boolean
  
  @boundsType(true)
  declare public editable: boolean
  
  @boundsType(0)
  declare public width: number
  
  @surfaceType(RICHTEXT_DEFAULTS.cursorColor)
  declare public cursorColor: string
  
  @surfaceType(RICHTEXT_DEFAULTS.cursorWidth)
  declare public cursorWidth: number
  
  @surfaceType(RICHTEXT_DEFAULTS.selectionColor)
  declare public selectionColor: string
  
  // 字符级样式（用于导入/导出 JSON）
  public get styles(): any {
    return this._serializeStyles()
  }
  
  public set styles(value: any) {
    if (value) {
      this._deserializeStyles(value)
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
  
  constructor(data?: IRichTextInputData) {
    super(data)
    
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
    
    // 创建离屏 canvas 用于测量
    this._measureCanvas = document.createElement('canvas')
    this._measureCtx = this._measureCanvas.getContext('2d')!
    
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
    this._updateGraphemes()
    this._measureText()
    
    const box = this.__layout.boxBounds
    const { width, height } = this._getTextBounds()
    
    box.x = 0
    box.y = 0
    box.width = width
    box.height = height
  }
  
  /**
   * 绘制碰撞路径（必须实现）
   */
  __drawHitPath(hitCanvas: ILeaferCanvas): void {
    const { context } = hitCanvas
    const { x, y, width, height } = this.__layout.boxBounds
    
    context.beginPath()
    context.rect(x, y, width, height)
  }
  
  /**
   * 自定义绘制（核心）
   */
  __draw(canvas: ILeaferCanvas): void {
    const ctx = canvas.context as CanvasRenderingContext2D
    
    ctx.save()
    
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
    this._graphemes = graphemeSplit(text)
    this._lines = this._splitLines()
    
    // 如果有待应用的线性样式，转换为 2D
    if (this._pendingLinearStyles) {
      this._applyPendingStyles()
    }
  }
  
  private _splitLines(): string[][] {
    if (!this._graphemes.length) return [[]]
    
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
  
  private _measureText(): void {
    this._lineMetrics = []
    
    const lineHeight = this.fontSize * RICHTEXT_DEFAULTS.lineHeight
    let y = 0
    
    for (let lineIdx = 0; lineIdx < this._lines.length; lineIdx++) {
      const line = this._lines[lineIdx]
      const chars: ICharMetrics[] = []
      let x = 0
      
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
        
        chars.push({ char, x, width, style })
        x += width
      }
      
      this._lineMetrics.push({ chars, y, height: lineHeight })
      y += lineHeight
    }
  }
  
  private _getTextBounds(): { width: number; height: number } {
    if (!this._lineMetrics.length) {
      return { width: this.width || 100, height: this.fontSize * RICHTEXT_DEFAULTS.lineHeight }
    }
    
    const maxWidth = Math.max(
      ...this._lineMetrics.map(line => {
        if (!line.chars.length) return 0
        const lastChar = line.chars[line.chars.length - 1]
        return lastChar.x + lastChar.width
      }),
      this.width || 0
    )
    
    const totalHeight = this._lineMetrics.reduce((sum, line) => sum + line.height, 0)
    
    return { width: maxWidth || 100, height: totalHeight || this.fontSize * RICHTEXT_DEFAULTS.lineHeight }
  }
  
  // ============ 样式管理 ============
  
  private _getCharStyle(lineIdx: number, charIdx: number): ICharStyle {
    const lineStyles = this._styles.get(lineIdx)
    const charStyle = lineStyles?.get(charIdx) || {}
    
    const result = {
      fill: this.fill,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fontWeight: this.fontWeight as any,
      italic: this.italic,
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
    
    // 找到对应的行
    let lineIndex = 0
    for (let i = 0; i < this._lineMetrics.length; i++) {
      const line = this._lineMetrics[i]
      if (y >= line.y && y < line.y + line.height) {
        lineIndex = i
        break
      }
      if (y >= line.y + line.height) lineIndex = i
    }
    
    lineIndex = Math.max(0, Math.min(lineIndex, this._lineMetrics.length - 1))
    const line = this._lineMetrics[lineIndex]
    if (!line) return 0
    
    // 在行内找字符
    let charIndex = 0
    if (line.chars.length === 0) {
      charIndex = 0
    } else {
      for (let i = 0; i < line.chars.length; i++) {
        const char = line.chars[i]
        if (x < char.x + char.width / 2) {
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
    for (const line of this._lineMetrics) {
      for (const char of line.chars) {
        const { x, style } = char
        const y = line.y + line.height * 0.8
        
        ctx.save()
        
        // 背景色
        if (style.textBackgroundColor) {
          ctx.fillStyle = style.textBackgroundColor
          ctx.fillRect(x, line.y, char.width, line.height)
        }
        
        // 文字
        ctx.fillStyle = style.fill || '#000'
        ctx.font = buildFontString(
          style.fontSize!,
          style.fontFamily!,
          style.fontWeight,
          style.italic
        )
        ctx.fillText(char.char, x, y)
        
        // 下划线
        if (style.underline) {
          ctx.strokeStyle = style.fill || '#000'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x, y + 2)
          ctx.lineTo(x + char.width, y + 2)
          ctx.stroke()
        }
        
        // 删除线
        if (style.linethrough) {
          ctx.strokeStyle = style.fill || '#000'
          ctx.lineWidth = 1
          ctx.beginPath()
          const midY = line.y + line.height * 0.5
          ctx.moveTo(x, midY)
          ctx.lineTo(x + char.width, midY)
          ctx.stroke()
        }
        
        ctx.restore()
      }
    }
  }
  
  private _drawSelection(ctx: CanvasRenderingContext2D): void {
    const start = this._linearToLocation(this.selectionStart)
    const end = this._linearToLocation(this.selectionEnd)
    
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
        x1 = lastChar.x + lastChar.width
        x2 = x1 + 10
      } else {
        x1 = line.chars[startChar]?.x || 0
        if (endChar === 0) {
          x2 = 0
        } else if (endChar >= line.chars.length) {
          const lastChar = line.chars[line.chars.length - 1]
          x2 = lastChar.x + lastChar.width
        } else {
          x2 = line.chars[endChar]?.x || x1
        }
      }
      
      if (x2 > x1) {
        ctx.fillRect(x1, line.y, x2 - x1, line.height)
      }
    }
  }
  
  private _drawCursor(ctx: CanvasRenderingContext2D): void {
    const loc = this._linearToLocation(this.selectionStart)
    const line = this._lineMetrics[loc.lineIndex]
    if (!line) return
    
    let x = 0
    if (line.chars.length === 0 || loc.charIndex === 0) {
      x = 0
    } else if (loc.charIndex >= line.chars.length) {
      const lastChar = line.chars[line.chars.length - 1]
      x = lastChar.x + lastChar.width
    } else {
      x = line.chars[loc.charIndex].x
    }
    
    ctx.globalAlpha = this._cursorOpacity
    ctx.fillStyle = this.cursorColor
    ctx.fillRect(x, line.y, this.cursorWidth, line.height)
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
