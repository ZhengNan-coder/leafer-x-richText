// 主入口 - RichText Demo
import { App } from 'leafer-ui'
import { EditorEvent, InnerEditorEvent, EditorScaleEvent } from '@leafer-in/editor'
import { RichText } from './richtext'
import type { ICharStyle } from './richtext'
// RichTextEditor 会在 import richtext 时自动注册

// 创建应用（启用编辑器）
const app = new App({
  view: document.getElementById('canvas')!,
  width: window.innerWidth - 300,
  height: window.innerHeight,
  tree: {},
  editor: {}  // 启用编辑器
})

// 当前被面板操作的 RichText（选中或正在编辑的任意一个）
let currentRichText: RichText | null = null

function getCurrentRichText(): RichText | null {
  return currentRichText
}

function setCurrentRichText(rt: RichText | null): void {
  currentRichText = rt
  updatePanelFromRichText(rt)
}

// 创建 RichText 实例（多样式示例 - 自动宽高）
const richtext = new RichText({
  x: 100,
  y: 100,
  text: '欢迎使用 RichText！\n这是一段支持自动宽高的文本。\n宽度和高度会随内容自动调整。',
  fontSize: 24,
  fill: '#333',
  editable: true,
  
  // 自动宽高（默认 true，宽高由内容决定）
  autoWidth: true,
  autoHeight: true,
  
  // 其他属性
  lineHeight: 1.8,
  letterSpacing: 1,
  textAlign: 'left',
  padding: 15,
  
  onEditingEntered: () => updateSelectionInfo(),
  onEditingExited: () => updateSelectionInfo()
})

app.tree.add(richtext)
currentRichText = richtext

// 获取编辑器实例
const editor = app.editor

// 通用：选中变化或进入内部编辑时，同步“当前 RichText”
if (editor) {
  editor.on(EditorEvent.SELECT as any, () => {
    const list = editor.list
    if (list?.length && (list[0] as any).__tag === 'RichText') {
      setCurrentRichText(list[0] as RichText)
    } else {
      setCurrentRichText(null)
    }
  })
  editor.on(EditorEvent.AFTER_SELECT as any, () => {
    const list = editor.list
    if (list?.length && (list[0] as any).__tag === 'RichText') {
      setCurrentRichText(list[0] as RichText)
    } else {
      setCurrentRichText(null)
    }
  })
  editor.on(InnerEditorEvent.OPEN as any, (e: { editTarget: any }) => {
    const target = e?.editTarget
    if (target?.__tag === 'RichText') {
      setCurrentRichText(target as RichText)
    }
  })
  
  // ✅ 监听缩放事件：拖动边框调整尺寸时，自动切换为固定尺寸模式
  editor.on(EditorScaleEvent.SCALE as any, (e: any) => {
    const list = editor.list
    if (!list?.length) return
    
    const target = list[0]
    if (target.__tag === 'RichText') {
      const richtext = target as RichText
      
      // 检查是否是拖动手柄（而非代码设置或键盘缩放）
      if (e.drag) {
        console.log('📏 检测到拖动调整尺寸，自动切换为固定尺寸模式')
        console.log('  scaleX:', e.scaleX, 'scaleY:', e.scaleY)
        
        // 延迟处理，等待 Leafer 完成缩放和重新计算 bounds
        setTimeout(() => {
          // 获取缩放后的实际尺寸
          const bounds = richtext.__layout.boxBounds
          const newWidth = bounds.width
          const newHeight = bounds.height
          
          console.log('  缩放后尺寸:', newWidth.toFixed(1), 'x', newHeight.toFixed(1))
          
          // 自动切换为固定尺寸（只切换被拖动的方向）
          let switched = false
          
          // 检测是否横向缩放（宽度变化）
          if (Math.abs(e.scaleX - 1) > 0.01 && richtext.autoWidth) {
            richtext.autoWidth = false
            richtext.width = newWidth
            console.log(`  ✅ autoWidth: true → false, width: ${newWidth.toFixed(0)}`)
            switched = true
          }
          
          // 检测是否纵向缩放（高度变化）
          if (Math.abs(e.scaleY - 1) > 0.01 && richtext.autoHeight) {
            richtext.autoHeight = false
            richtext.height = newHeight
            console.log(`  ✅ autoHeight: true → false, height: ${newHeight.toFixed(0)}`)
            switched = true
          }
          
          if (switched) {
            // 更新面板显示
            updatePanelFromRichText(richtext)
            richtext.forceRender()
          }
        }, 10)
      }
    }
  })
}



// 监听编辑器事件
// 设置初始多样式（等待渲染完成）
setTimeout(() => {
  richtext.enterEditing()
  
  // 测试混合字号基线对齐
  // "欢迎使用" - 大字号（验证基线对齐）
  richtext.selectionStart = 0
  richtext.selectionEnd = 4
  richtext.setSelectionStyles({
    fontSize: 48,  // 大字号
    fontWeight: 'bold',
    fill: '#ff0000'
  })
  
  // "RichText" - 小字号（应该与大字在同一基线上）
  richtext.selectionStart = 5
  richtext.selectionEnd = 13
  richtext.setSelectionStyles({
    fontSize: 16,  // 小字号
    fill: '#0066ff',
    italic: true
  })
  
  // 第二行 - 中等字号
  richtext.selectionStart = 14
  richtext.selectionEnd = 20
  richtext.setSelectionStyles({
    fontSize: 32,
    textDecoration: 'under',
    fill: '#00aa00',
    fontWeight: 'bold'
  })
  
  console.log('✅ 样式设置完成 - 测试基线对齐')
  console.log('第一行：48px 大字 + 16px 小字 应该在同一基线上')
  console.log('lineHeight: 1.8，文本应该垂直居中于行高')
  
  // 退出编辑显示效果
  richtext.selectionStart = richtext.selectionEnd = 0
  richtext.exitEditing()
}, 2000)

// 获取面板元素
const fontSizeInput = document.getElementById('fontSize') as HTMLInputElement
const fontFamilySelect = document.getElementById('fontFamily') as HTMLSelectElement
const fillInput = document.getElementById('fill') as HTMLInputElement
const letterSpacingInput = document.getElementById('letterSpacing') as HTMLInputElement
const lineHeightInput = document.getElementById('lineHeight') as HTMLInputElement
const textAlignSelect = document.getElementById('textAlign') as HTMLSelectElement
const textCaseSelect = document.getElementById('textCase') as HTMLSelectElement
const paddingInput = document.getElementById('padding') as HTMLInputElement
const autoWidthCheckbox = document.getElementById('autoWidth') as HTMLInputElement
const autoHeightCheckbox = document.getElementById('autoHeight') as HTMLInputElement
const fixedWidthInput = document.getElementById('fixedWidth') as HTMLInputElement
const fixedHeightInput = document.getElementById('fixedHeight') as HTMLInputElement
const textWrapSelect = document.getElementById('textWrap') as HTMLSelectElement
const textOverflowSelect = document.getElementById('textOverflow') as HTMLSelectElement
const btnBold = document.getElementById('btnBold')!
const btnItalic = document.getElementById('btnItalic')!
const btnUnderline = document.getElementById('btnUnderline')!
const btnStrike = document.getElementById('btnStrike')!
const btnSelectAll = document.getElementById('btnSelectAll')!
const btnClearStyles = document.getElementById('btnClearStyles')!
const btnAddText = document.getElementById('btnAddText')!
const btnExportJSON = document.getElementById('btnExportJSON')!
const debugModeCheckbox = document.getElementById('debugMode') as HTMLInputElement
const selectionInfo = document.getElementById('selectionInfo')!

// 根据当前选中的 RichText 更新面板控件
function updatePanelFromRichText(rt: RichText | null): void {
  if (!fontSizeInput || !fillInput || !fontFamilySelect) return
  if (!rt) {
    fontSizeInput.value = '24'
    fillInput.value = '#333333'
    fontFamilySelect.value = 'Arial'
    letterSpacingInput.value = '0'
    lineHeightInput.value = '1.5'
    textAlignSelect.value = 'left'
    textCaseSelect.value = 'none'
    paddingInput.value = '0'
    autoWidthCheckbox.checked = true
    autoHeightCheckbox.checked = true
    fixedWidthInput.value = '400'
    fixedHeightInput.value = '200'
    fixedWidthInput.disabled = true
    fixedHeightInput.disabled = true
    textWrapSelect.value = 'normal'
    textOverflowSelect.value = 'show'
    btnBold?.classList.remove('active')
    btnItalic?.classList.remove('active')
    btnUnderline?.classList.remove('active')
    btnStrike?.classList.remove('active')
    return
  }
  
  // 获取当前样式（选区样式或基础样式）
  const style = rt.isEditing && rt.selectionStart !== rt.selectionEnd
    ? rt.getSelectionStyles()[0]
    : rt.getStyleAt(0)
  const s = style || {}
  
  // 基础样式
  fontSizeInput.value = String(s.fontSize ?? rt.fontSize ?? 24)
  fillInput.value = (s.fill ?? rt.fill ?? '#333').toString().slice(0, 7)
  fontFamilySelect.value = (s.fontFamily ?? rt.fontFamily ?? 'Arial') as string
  
  // 新属性
  const letterSpacing = s.letterSpacing ?? rt.letterSpacing ?? 0
  letterSpacingInput.value = String(typeof letterSpacing === 'number' ? letterSpacing : letterSpacing.value)
  
  // lineHeight 是段落属性，从元素获取
  const lineHeight = rt.lineHeight ?? 1.5
  lineHeightInput.value = String(typeof lineHeight === 'number' ? lineHeight : lineHeight.value)
  
  textAlignSelect.value = (rt.textAlign ?? 'left') as string
  textCaseSelect.value = (s.textCase ?? rt.textCase ?? 'none') as string
  
  const padding = rt.padding ?? 0
  paddingInput.value = String(typeof padding === 'number' ? padding : padding[0])
  
  autoWidthCheckbox.checked = rt.autoWidth ?? true
  autoHeightCheckbox.checked = rt.autoHeight ?? true
  fixedWidthInput.value = String(rt.width ?? 400)
  fixedHeightInput.value = String(rt.height ?? 200)
  fixedWidthInput.disabled = autoWidthCheckbox.checked
  fixedHeightInput.disabled = autoHeightCheckbox.checked
  
  textWrapSelect.value = (rt.textWrap ?? 'normal') as string
  textOverflowSelect.value = (rt.textOverflow ?? 'show') as string
  
  // 样式按钮
  const styleObj = s as ICharStyle
  if (btnBold) btnBold.classList.toggle('active', styleObj.fontWeight === 'bold')
  if (btnItalic) btnItalic.classList.toggle('active', !!styleObj.italic)
  if (btnUnderline) btnUnderline.classList.toggle('active', !!styleObj.underline)
  if (btnStrike) btnStrike.classList.toggle('active', !!styleObj.linethrough)
}

// 应用样式：未进入编辑或无选区时作用整段（全量样式），有选区时作用选区
function applyStyle(styleObj: Partial<ICharStyle>) {
  const rt = getCurrentRichText()
  if (!rt) {
    alert('请先选中文本')
    return
  }
  const hasSelection = rt.isEditing && rt.selectionStart !== rt.selectionEnd
  if (hasSelection) {
    rt.setSelectionStyles(styleObj)
  } else {
    rt.setFullTextStyles(styleObj)
  }
  updatePanelFromRichText(rt)
}

// 事件监听（添加聚焦处理）
function getCurrentStyleForPanel(rt: RichText): ICharStyle | undefined {
  return rt.isEditing && rt.selectionStart !== rt.selectionEnd
    ? rt.getSelectionStyles()[0]
    : rt.getStyleAt(0)
}

fontSizeInput.addEventListener('input', () => {
  applyStyle({ fontSize: parseInt(fontSizeInput.value) })
  refocusTextarea()
})

fontFamilySelect.addEventListener('change', () => {
  applyStyle({ fontFamily: fontFamilySelect.value })
  refocusTextarea()
})

fillInput.addEventListener('input', () => {
  applyStyle({ fill: fillInput.value })
  refocusTextarea()
})

btnBold.addEventListener('click', () => {
  const rt = getCurrentRichText()
  if (!rt) return
  const s = getCurrentStyleForPanel(rt)
  const isBold = s?.fontWeight === 'bold'
  applyStyle({ fontWeight: isBold ? 'normal' : 'bold' })
  refocusTextarea()
})

btnItalic.addEventListener('click', () => {
  const rt = getCurrentRichText()
  if (!rt) return
  const s = getCurrentStyleForPanel(rt)
  const isItalic = s?.italic === true
  applyStyle({ italic: !isItalic })
  refocusTextarea()
})

btnUnderline.addEventListener('click', () => {
  const rt = getCurrentRichText()
  if (!rt) return
  const s = getCurrentStyleForPanel(rt)
  const hasUnderline = s?.underline === true
  applyStyle({ underline: !hasUnderline })
  refocusTextarea()
})

btnStrike.addEventListener('click', () => {
  const rt = getCurrentRichText()
  if (!rt) return
  const s = getCurrentStyleForPanel(rt)
  const hasStrike = s?.linethrough === true
  applyStyle({ linethrough: !hasStrike })
  refocusTextarea()
})

// 新属性控件事件
letterSpacingInput.addEventListener('input', () => {
  applyStyle({ letterSpacing: parseFloat(letterSpacingInput.value) })
  refocusTextarea()
})

lineHeightInput.addEventListener('input', () => {
  const rt = getCurrentRichText()
  if (!rt) return
  // lineHeight 是段落属性，应用到整个元素
  rt.lineHeight = parseFloat(lineHeightInput.value)
  updatePanelFromRichText(rt)
  refocusTextarea()
})

textAlignSelect.addEventListener('change', () => {
  const rt = getCurrentRichText()
  if (!rt) return
  // textAlign 是段落属性，应用到整个元素
  rt.textAlign = textAlignSelect.value as any
  updatePanelFromRichText(rt)
  refocusTextarea()
})

textCaseSelect.addEventListener('change', () => {
  applyStyle({ textCase: textCaseSelect.value as any })
  refocusTextarea()
})

paddingInput.addEventListener('input', () => {
  const rt = getCurrentRichText()
  if (!rt) return
  rt.padding = parseFloat(paddingInput.value)
  refocusTextarea()
})

textWrapSelect.addEventListener('change', () => {
  const rt = getCurrentRichText()
  if (!rt) return
  rt.textWrap = textWrapSelect.value as any
  refocusTextarea()
})

textOverflowSelect.addEventListener('change', () => {
  const rt = getCurrentRichText()
  if (!rt) return
  rt.textOverflow = textOverflowSelect.value
  refocusTextarea()
})

// 调试模式切换
debugModeCheckbox.addEventListener('change', () => {
  const rt = getCurrentRichText()
  if (!rt) return
  rt.debugMode = debugModeCheckbox.checked
  rt.forceRender()
})

// 自动宽度控制
autoWidthCheckbox.addEventListener('change', () => {
  const rt = getCurrentRichText()
  if (!rt) return
  
  // 如果切换为固定宽度，且当前 width 为 0，设置为当前实际宽度
  if (!autoWidthCheckbox.checked && (!rt.width || rt.width <= 0)) {
    const currentWidth = rt.__layout.boxBounds.width
    rt.width = currentWidth > 0 ? currentWidth : 400
    fixedWidthInput.value = String(rt.width)
  }
  
  rt.autoWidth = autoWidthCheckbox.checked
  fixedWidthInput.disabled = autoWidthCheckbox.checked
  updatePanelFromRichText(rt)
  refocusTextarea()
})

// 自动高度控制
autoHeightCheckbox.addEventListener('change', () => {
  const rt = getCurrentRichText()
  if (!rt) return
  
  // 如果切换为固定高度，且当前 height 为 0，设置为当前实际高度
  if (!autoHeightCheckbox.checked && (!rt.height || rt.height <= 0)) {
    const currentHeight = rt.__layout.boxBounds.height
    rt.height = currentHeight > 0 ? currentHeight : 200
    fixedHeightInput.value = String(rt.height)
  }
  
  rt.autoHeight = autoHeightCheckbox.checked
  fixedHeightInput.disabled = autoHeightCheckbox.checked
  updatePanelFromRichText(rt)
  refocusTextarea()
})

// 固定宽度输入
fixedWidthInput.addEventListener('input', () => {
  const rt = getCurrentRichText()
  if (!rt || rt.autoWidth) return
  rt.width = parseFloat(fixedWidthInput.value)
  updatePanelFromRichText(rt)
  refocusTextarea()
})

// 固定高度输入
fixedHeightInput.addEventListener('input', () => {
  const rt = getCurrentRichText()
  if (!rt || rt.autoHeight) return
  rt.height = parseFloat(fixedHeightInput.value)
  updatePanelFromRichText(rt)
  refocusTextarea()
})

// 重新聚焦当前 RichText 的 textarea（仅编辑中时有效）
function refocusTextarea() {
  const rt = getCurrentRichText()
  if (rt?.isEditing) setTimeout(() => rt.refocus(), 50)
}

btnSelectAll.addEventListener('click', () => {
  const rt = getCurrentRichText()
  if (!rt) {
    alert('请先选中或点击文本')
    return
  }
  if (!rt.isEditing) rt.enterEditing()
  rt.selectAll()
  refocusTextarea()
})

btnClearStyles.addEventListener('click', () => {
  const rt = getCurrentRichText()
  if (!rt) {
    alert('请先选中文本')
    return
  }
  if (rt.isEditing && rt.selectionStart !== rt.selectionEnd) {
    rt.clearSelectionStyles()
  } else {
    rt.clearFullTextStyles()
  }
  updatePanelFromRichText(rt)
  refocusTextarea()
})

btnAddText.addEventListener('click', () => {
  const newText = new RichText({
    x: 100,
    y: 450,
    text: '测试固定宽度换行：这是测试文本',
    fontSize: 20,
    fill: '#666',
    editable: true,
    
    // 固定宽度，自动高度（测试编辑时换行）
    width: 300,
    autoWidth: false,  // 固定宽度
    autoHeight: true,  // 高度自动
    
    // 段落属性
    lineHeight: 1.8,
    textAlign: 'left',
    padding: 15,
    textWrap: 'normal',  // 启用自动换行
    
    // 字符级样式（测试不同字号的换行）
    styleRanges: [
      { start: 0, end: 2, fontSize: 32, fontWeight: 'bold', fill: '#ff6600' },  // "测试" 大字号
      { start: 9, end: 11, fontSize: 28, italic: true, fill: '#0088ff' }  // "测试" 大字号
    ],
    onEditingEntered: () => updateSelectionInfo(),
    onEditingExited: () => updateSelectionInfo()
  })
  app.tree.add(newText)
  console.log('✅ 新增文本 - 测试固定宽度下大字号的换行')
  console.log('提示：双击进入编辑，在"测试"后面输入更多大字号文字，应该会自动换行')
  // 选中新文本，使右侧面板立即作用于它
  if (editor) editor.select(newText as any)
  setCurrentRichText(newText)
})


btnExportJSON.addEventListener('click', () => {
  const canvasJSON = app.tree.toJSON()
  
  const enhancedData: any = {
    version: '1.0',
    canvas: canvasJSON,
    richtexts: []
  }
  
  // 遍历查找所有 RichText 元素
  app.tree.children.forEach((child: any) => {
    if (child.__tag === 'RichText') {
      const richtextData = {
        innerId: child.innerId,
        text: child.text,
        styles: serializeStyles(child._styles),  // 字符级样式
        bounds: {
          x: child.x,
          y: child.y,
          width: child.width
        },
        textProps: {
          fontSize: child.fontSize,
          fontFamily: child.fontFamily,
          fontWeight: child.fontWeight,
          fill: child.fill,
          italic: child.italic,
          editable: child.editable
        }
      }
      enhancedData.richtexts.push(richtextData)
    }
  })
  
  // 复制到剪贴板
  const exportText = JSON.stringify(enhancedData, null, 2)
  navigator.clipboard.writeText(exportText).then(() => {
    alert(`✅ 画布 JSON 已导出！

📋 已复制到剪贴板
📊 包含 ${enhancedData.richtexts.length} 个 RichText 元素
🎨 包含完整的字符级样式数据

请查看控制台获取详细内容。`)
  }).catch(() => {
    alert('✅ JSON 已导出到控制台！\n\n查看控制台获取完整数据。')
  })
})

// 序列化 Map 样式为普通对象
function serializeStyles(stylesMap: any): any {
  const result: any = {}
  if (!stylesMap || !stylesMap.entries) return result
  
  for (const [lineIdx, lineStyles] of stylesMap.entries()) {
    result[lineIdx] = {}
    if (lineStyles && lineStyles.entries) {
      for (const [charIdx, style] of lineStyles.entries()) {
        result[lineIdx][charIdx] = style
      }
    }
  }
  return result
}

// 更新选区信息显示（基于当前 RichText）
function updateSelectionInfo() {
  const rt = getCurrentRichText()
  if (!rt) {
    selectionInfo.textContent = '未选中文本'
    return
  }
  if (rt.isEditing) {
    const start = rt.selectionStart
    const end = rt.selectionEnd
    const length = end - start
    selectionInfo.textContent = length > 0
      ? `选中了 ${length} 个字符 (${start}-${end})`
      : `光标位置: ${start}`
  } else {
    selectionInfo.textContent = '已选中，双击进入编辑'
  }
}

// 定时更新选区信息
setInterval(updateSelectionInfo, 100)
