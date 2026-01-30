// 主入口 - RichText Demo
import { App } from 'leafer-ui'
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

// 创建 RichText 实例（多样式示例）
const richtext = new RichText({
  x: 100,
  y: 100,
  text: '欢迎使用 RichText！\n这是一段支持富文本编辑的文字。\n你可以设置不同的样式。',
  fontSize: 24,
  fill: '#333',
  editable: true,
  // 使用回调避免 emit 问题
  onEditingEntered: () => updateSelectionInfo(),
  onEditingExited: () => updateSelectionInfo()
})

app.tree.add(richtext)

// 获取编辑器实例
const editor = app.editor



// 监听编辑器事件
// 设置初始多样式（等待渲染完成）
setTimeout(() => {
  richtext.enterEditing()
  
  // 第一行 "欢迎使用" - 加粗红色大字
  richtext.selectionStart = 0
  richtext.selectionEnd = 4
  richtext.setSelectionStyles({
    fontSize: 32,
    fontWeight: 'bold',
    fill: '#ff0000'
  })
  
  // "RichText" - 蓝色斜体
  richtext.selectionStart = 5
  richtext.selectionEnd = 13
  richtext.setSelectionStyles({
    fill: '#0066ff',
    italic: true,
    fontSize: 28
  })
  
  // 第二行 "这是一段支持" - 绿色下划线
  const line2Start = 14
  richtext.selectionStart = line2Start
  richtext.selectionEnd = line2Start + 6
  richtext.setSelectionStyles({
    underline: true,
    fill: '#00aa00',
    fontSize: 20
  })
  
  // "富文本编辑" - 紫色加粗
  richtext.selectionStart = line2Start + 6
  richtext.selectionEnd = line2Start + 11
  richtext.setSelectionStyles({
    fill: '#9900ff',
    fontWeight: 'bold',
    fontSize: 26
  })
  
  // 第三行 "不同的样式" - 黄色背景
  const line3Start = 14 + 15 + 1
  richtext.selectionStart = line3Start + 3
  richtext.selectionEnd = line3Start + 8
  richtext.setSelectionStyles({
    textBackgroundColor: '#ffff00',
    fontWeight: 'bold'
  })
  
  // 退出编辑显示效果
  richtext.selectionStart = richtext.selectionEnd = 0
  richtext.exitEditing()
}, 2000)

// 获取面板元素
const fontSizeInput = document.getElementById('fontSize') as HTMLInputElement
const fontFamilySelect = document.getElementById('fontFamily') as HTMLSelectElement
const fillInput = document.getElementById('fill') as HTMLInputElement
const btnBold = document.getElementById('btnBold')!
const btnItalic = document.getElementById('btnItalic')!
const btnUnderline = document.getElementById('btnUnderline')!
const btnStrike = document.getElementById('btnStrike')!
const btnSelectAll = document.getElementById('btnSelectAll')!
const btnClearStyles = document.getElementById('btnClearStyles')!
const btnAddText = document.getElementById('btnAddText')!
const btnExportJSON = document.getElementById('btnExportJSON')!
const selectionInfo = document.getElementById('selectionInfo')!

// 应用样式到选区
function applyStyle(styleObj: Partial<ICharStyle>) {
  if (!richtext.isEditing) {
    alert('请先点击文本进入编辑模式')
    return
  }
  
  if (richtext.selectionStart === richtext.selectionEnd) {
    alert('请先选中文字')
    return
  }
  
  richtext.setSelectionStyles(styleObj)
}

// 事件监听（添加聚焦处理）
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
  const styles = richtext.getSelectionStyles()
  const isBold = styles[0]?.fontWeight === 'bold'
  applyStyle({ fontWeight: isBold ? 'normal' : 'bold' })
  refocusTextarea()
})

btnItalic.addEventListener('click', () => {
  const styles = richtext.getSelectionStyles()
  const isItalic = styles[0]?.italic === true
  applyStyle({ italic: !isItalic })
  refocusTextarea()
})

btnUnderline.addEventListener('click', () => {
  const styles = richtext.getSelectionStyles()
  const hasUnderline = styles[0]?.underline === true
  applyStyle({ underline: !hasUnderline })
  refocusTextarea()
})

btnStrike.addEventListener('click', () => {
  const styles = richtext.getSelectionStyles()
  const hasStrike = styles[0]?.linethrough === true
  applyStyle({ linethrough: !hasStrike })
  refocusTextarea()
})

// 重新聚焦 textarea
function refocusTextarea() {
  setTimeout(() => {
    richtext.refocus()
  }, 50)
}

btnSelectAll.addEventListener('click', () => {
  if (!richtext.isEditing) {
    richtext.enterEditing()
  }
  richtext.selectAll()
  refocusTextarea()
})

btnClearStyles.addEventListener('click', () => {
  if (!richtext.isEditing) {
    alert('请先点击文本进入编辑模式')
    return
  }
  
  if (richtext.selectionStart === richtext.selectionEnd) {
    alert('请先选中文字')
    return
  }
  
  richtext.clearSelectionStyles()
  refocusTextarea()
})

btnAddText.addEventListener('click', () => {
  // ✅ 使用 styleRanges 格式创建多样式文本
  const newText = new RichText({
    x: 100,
    y: 450,
    text: '新建文本：支持多样式！',
    fontSize: 20,
    fill: '#666',
    editable: true,
    width: 400,
    // ✅ styleRanges 格式（简洁、和导出一致）
    styleRanges: [
      { start: 0, end: 4, fontSize: 28, fontWeight: 'bold', fill: '#ff6600' },
      { start: 5, end: 9, fontSize: 24, italic: true, fill: '#0088ff' }
    ]
  })
  app.tree.add(newText)
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

// 更新选区信息显示
function updateSelectionInfo() {
  if (richtext.isEditing) {
    const start = richtext.selectionStart
    const end = richtext.selectionEnd
    const length = end - start
    selectionInfo.textContent = length > 0 
      ? `选中了 ${length} 个字符 (${start}-${end})`
      : `光标位置: ${start}`
  } else {
    selectionInfo.textContent = '未编辑'
  }
}

// 定时更新选区信息
setInterval(updateSelectionInfo, 100)
