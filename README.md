# leafer-x-richText

Leafer 富文本插件：支持按字符设置样式的可编辑文本元素，行为类似 Fabric.js IText，完整支持 Leafer 文本样式规范，导出格式兼容 Figma 的 `styleRanges`。

## 特性

### 核心功能
- **按字符样式**：选中文字后可单独设置颜色、字体、字号、粗体、斜体、装饰线、背景色、大小写等
- **完整编辑**：光标、选区、输入法、复制粘贴、撤销重做
- **交互**：单击选中、双击进入编辑/选词、三击选行、拖拽选区
- **键盘**：方向键、Home/End、Ctrl+A/C/V/X/Z/Y、Ctrl+左右按词移动
- **序列化**：`toJSON()` 导出含 `styleRanges` 的 JSON，构造时支持 `styleRanges` 导入

### 完整的 Leafer 文本样式支持

#### 字符级样式（可对选中文字单独设置）
- **基础样式**：`fontSize`, `fontFamily`, `fontWeight`, `fill`（纯色/渐变）, `stroke`（描边）, `strokeWidth`, `italic`
- **文本格式**：`textCase`（大小写转换）, `textDecoration`（下划线/删除线）
- **字间距**：`letterSpacing`（支持数字或百分比）
- **背景**：`textBackgroundColor`

#### 阴影效果（对齐 Leafer 官方 Text 实现）
- **外阴影**：`shadow`（支持 color/blur/x/y/spread/blendMode，可数组多阴影）
- **内阴影**：`innerShadow`（同上，阴影限制在文字形状内部）
- 阴影不影响文本框尺寸（仅扩展渲染边界）
- 阴影不受 `textOverflow` 裁剪影响（超出文本框仍完整显示）
- `spread` 以文本框中心为原点整体缩放（与 Leafer 官方 `getShadowTransform` 一致）

#### 段落属性（作用于整个元素）
- **行高**：`lineHeight`（支持数字或百分比，默认 1.5）
- **对齐**：`textAlign`（左/中/右/两端对齐）, `verticalAlign`（垂直对齐）
- **内边距**：`padding`（支持单值或四值数组 [上,右,下,左]）
- **换行**：`textWrap`（normal/none/break），`textOverflow`（溢出处理）
- **段落间距**：`paraIndent`（首行缩进）, `paraSpacing`（段落间距）
- **自动尺寸**：`autoWidth`（自动宽度）, `autoHeight`（自动高度）, `autoSizeAlign`

### 高级排版特性
- ✅ **基线对齐**：同一行中不同字号的字符正确对齐在同一基线上
- ✅ **两端对齐**：自动调整字符间距填满整行（支持 justify/both 等模式）
- ✅ **自动换行**：固定宽度下按单词边界或强制断词换行
- ✅ **自动宽高**：默认宽高随内容自动调整，支持切换为固定尺寸
- ✅ **样式保留**：修改整段样式时只更新指定属性，保留其他字符级样式差异
- ✅ **文本描边**：支持内部/外部/居中描边对齐、虚线描边、端点/拐角样式
- ✅ **外阴影**：整体阴影渲染（非逐字），支持 spread 缩放、不受 textOverflow 裁剪
- ✅ **内阴影**：阴影限制在文字形状内部，支持 spread 向内扩展
- ✅ **多阴影叠加**：shadow/innerShadow 支持数组形式设置多个阴影效果
- ✅ **段落级两端对齐**：`justify` 模式下每个段落（`\n` 分隔）的最后一行不强制对齐

## 安装

```bash
npm install leafer-x-richText
# 或从仓库安装
npm install git+https://github.com/paiDaXing-web/leafer-x-richText.git
```

依赖：`leafer-ui`、`@leafer-in/editor`（若使用 Leafer 编辑器）。

## 快速开始

```ts
import { App } from 'leafer-ui'
import { RichText } from 'leafer-x-richText'
// 引入即自动注册内部编辑器，无需额外调用

const app = new App({
  view: document.getElementById('canvas'),
  width: 800,
  height: 600,
  tree: {},
  editor: {}  // 启用编辑器才能双击进入编辑
})

// 示例1：自动宽高文本（默认）
const autoText = new RichText({
  x: 100,
  y: 100,
  text: '可编辑富文本\n支持多行',
  fontSize: 24,
  fill: '#333',
  editable: true,
  // autoWidth: true,  // 默认值
  // autoHeight: true  // 默认值
})

// 示例2：固定宽度 + 自动换行
const fixedWidthText = new RichText({
  x: 100,
  y: 300,
  text: '这是一段很长的文本，会自动换行...',
  fontSize: 20,
  width: 300,
  autoWidth: false,  // 固定宽度
  autoHeight: true,  // 高度自动
  textWrap: 'normal', // 启用换行
  textAlign: 'justify', // 两端对齐
  lineHeight: 1.8,
  padding: 15
})

// 示例3：多样式文本
const styledText = new RichText({
  x: 500,
  y: 100,
  text: '多样式文本示例',
  fontSize: 24,
  styleRanges: [
    { start: 0, end: 3, fontSize: 32, fontWeight: 'bold', fill: '#ff0000' },
    { start: 3, end: 5, italic: true, fill: '#0066ff', textCase: 'upper' },
    { start: 5, end: 7, textDecoration: 'under', fill: '#00aa00' }
  ]
})

app.tree.add(autoText)
app.tree.add(fixedWidthText)
app.tree.add(styledText)
```

### 交互方式
- **单击**文本：选中元素（由 Leafer Editor 处理）
- **双击**文本：进入编辑模式，可输入、选区、设置样式
- **点击画布空白**：退出编辑
- **ESC**：退出编辑

## 使用说明

### 基本使用

1. **进入编辑**：双击文本（或代码中调用 `richtext.enterEditing()`）
2. **选区**：在编辑状态下拖拽或 Shift+方向键
3. **设置选区样式**：选区后调用 `richtext.setSelectionStyles({ fill, fontSize, fontWeight, ... })`

### 渐变填充示例

`fill` 支持 Leafer `IFill`，可用纯色或渐变：

```ts
const linearGradient = {
  type: 'linear',
  from: 'left',
  to: 'right',
  stops: [
    { offset: 0, color: '#ff4d4f' },
    { offset: 1, color: '#52c41a' }
  ]
}

richtext.setSelectionStyles({ fill: linearGradient })
```
### 描边示例

```ts
richtext.setSelectionStyles({
  stroke: { type: 'solid', color: '#ff0000' },
  strokeWidth: 2,
  strokeAlign: 'outside',
  strokeCap: 'round',
  strokeJoin: 'round',
  dashPattern: [6, 4],
  dashOffset: 0
})
```

### 阴影示例

```ts
// 外阴影（整体效果，不受 textOverflow 裁剪）
const shadowText = new RichText({
  text: '带阴影的文本',
  fontSize: 32,
  fill: '#333',
  shadow: {
    color: 'rgba(0, 0, 0, 0.5)',
    blur: 8,
    x: 0,
    y: 4,
    spread: 0           // 扩散：以文本框中心整体缩放阴影
  }
})

// 内阴影
const innerShadowText = new RichText({
  text: '内阴影文本',
  fontSize: 48,
  fill: '#fff',
  innerShadow: {
    color: 'rgba(0, 0, 0, 0.6)',
    blur: 6,
    x: 2,
    y: 2,
    spread: 0
  }
})

// 多阴影（数组形式）
const multiShadow = new RichText({
  text: '多重阴影',
  fontSize: 36,
  shadow: [
    { color: 'rgba(255, 0, 0, 0.5)', blur: 10, x: -4, y: -4 },
    { color: 'rgba(0, 0, 255, 0.5)', blur: 10, x: 4, y: 4 }
  ]
})

// 通过面板/API 设置阴影
richtext.setFullTextStyles({
  shadow: { color: '#000', blur: 12, x: 0, y: 6, spread: 4 }
} as any)
```
4. **设置整段样式**：选中元素（不进入编辑），调用 `richtext.setFullTextStyles({ fontWeight: 'bold' })`，只修改指定属性
5. **退出编辑**：ESC 或点击空白（或 `richtext.exitEditing()`）

### 样式应用逻辑

**关键特性：只修改指定属性，保留其他样式**

```typescript
// 场景1：整段设置加粗（保留原有颜色等样式）
richtext.setFullTextStyles({ fontWeight: 'bold' })
// 结果：所有字符变为加粗，但原有的不同颜色、字号等都保留

// 场景2：选区设置样式
richtext.enterEditing()
richtext.selectionStart = 0
richtext.selectionEnd = 5
richtext.setSelectionStyles({ fill: '#ff0000', fontSize: 32 })
// 结果：只有选中的5个字符变为红色32号字
```

### 自动宽高与固定尺寸

```typescript
// 自动宽高（默认）- 宽高随内容调整
const auto = new RichText({
  text: '自动调整',
  autoWidth: true,   // 默认值
  autoHeight: true   // 默认值
})

// 固定宽度 + 自动换行
const fixed = new RichText({
  text: '很长的文本会自动换行...',
  width: 300,
  autoWidth: false,  // 关闭自动宽度
  textWrap: 'normal' // 启用换行
})

// 固定宽高 + 溢出处理
const container = new RichText({
  text: '内容很多...',
  width: 400,
  height: 200,
  autoWidth: false,
  autoHeight: false,
  textOverflow: '...'  // 超出显示省略号
})
```

### 高级排版

```typescript
// 两端对齐 + 不同字号混排
const justified = new RichText({
  text: '两端对齐示例文本',
  width: 400,
  autoWidth: false,
  textAlign: 'justify',  // 两端对齐
  lineHeight: 1.8,
  padding: [10, 20, 10, 20],
  styleRanges: [
    { start: 0, end: 2, fontSize: 32 },  // 大字号
    { start: 2, end: 4, fontSize: 16 }   // 小字号
  ]
  // 不同字号会自动基线对齐，字符间距自动调整填满整行
})
```

### 与 Leafer Editor 配合

内部编辑器名称为 `RichTextEditor`，RichText 通过 `editInner: 'RichTextEditor'` 与之绑定（已内置，无需手动设置）。

当元素被 Editor 选中时，可以拖拽、缩放、旋转等；双击进入内部编辑器进行文本编辑。

---

## API

### 安装（可选）

```ts
import { install } from 'leafer-x-richText'
install()  // 仅当未通过主入口 "leafer-x-richText" 引入时需调用
```

引入 `leafer-x-richText` 时已自动注册内部编辑器，一般无需单独 `install()`。

---

### RichText

继承自 Leafer `UI`，可放在 `app.tree` 上使用。

#### 构造选项 `IRichTextInputData`

**基础属性**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | `string` | `''` | 文本内容 |
| `x`, `y` | `number` | - | 位置 |
| `editable` | `boolean` | `true` | 是否可编辑 |

**字符样式（基础，可被字符级样式覆盖）**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fontSize` | `number` | `16` | 字号 |
| `fontFamily` | `string` | `'Arial, sans-serif'` | 字体 |
| `fontWeight` | `IFontWeight` | `'normal'` | 字重（normal/bold/100-900） |
| `fill` | `IFill` | `'#000000'` | 填充色（纯色/渐变/图像） |
| `stroke` | `IStroke` | `undefined` | 描边（纯色/渐变/图案/多描边） |
| `strokeWidth` | `number` | `0` | 描边宽度 |
| `strokeAlign` | `'inside' \| 'center' \| 'outside'` | `'outside'` | 描边对齐方式 |
| `strokeCap` | `'none' \| 'round' \| 'square'` | `'none'` | 描边端点形状 |
| `strokeJoin` | `'miter' \| 'bevel' \| 'round'` | `'miter'` | 描边拐角处理 |
| `dashPattern` | `number[]` | `undefined` | 虚线描边间隔 |
| `dashOffset` | `number` | `0` | 虚线起点偏移 |
| `shadow` | `object \| object[]` | `undefined` | 外阴影（支持 color/blur/x/y/spread/blendMode） |
| `innerShadow` | `object \| object[]` | `undefined` | 内阴影（同上，限制在文字形状内部） |
| `italic` | `boolean` | `false` | 是否斜体 |
| `textCase` | `ITextCase` | `'none'` | 大小写（none/upper/lower/title） |
| `textDecoration` | `ITextDecoration` | `'none'` | 装饰线（none/under/delete/under-delete） |
| `letterSpacing` | `number \| IUnitData` | `0` | 字间距 |

**段落属性（作用于整个元素）**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `lineHeight` | `number \| IUnitData` | `1.5` | 行高（数字或 {type:'percent', value:1.5}） |
| `textAlign` | `ITextAlign` | `'left'` | 水平对齐（left/center/right/justify/both） |
| `verticalAlign` | `IVerticalAlign` | `'top'` | 垂直对齐（top/middle/bottom） |
| `padding` | `number \| number[]` | `0` | 内边距（单值或 [上,右,下,左]） |
| `paraIndent` | `number` | `0` | 段落首行缩进 |
| `paraSpacing` | `number` | `0` | 段落间距 |
| `textWrap` | `ITextWrap` | `'normal'` | 换行规则（normal/none/break） |
| `textOverflow` | `IOverflow \| string` | `'show'` | 溢出处理（show/hide/自定义省略符） |
| `autoSizeAlign` | `boolean` | `true` | 自动尺寸时是否对齐 |

**尺寸控制**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `width` | `number` | `0` | 固定宽度（0 或未设置时自动） |
| `height` | `number` | `0` | 固定高度（0 或未设置时自动） |
| `autoWidth` | `boolean` | `true` | 自动宽度（宽度随内容调整） |
| `autoHeight` | `boolean` | `true` | 自动高度（高度随内容调整） |

**样式数据**

| 属性 | 类型 | 说明 |
|------|------|------|
| `styleRanges` | `IStyleRange[]` | 按范围设置的样式（推荐格式） |
| `styles` | `object` | 旧版按行/字索引的样式（兼容） |

**编辑器相关**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `cursorColor` | `string` | `'#000000'` | 光标颜色 |
| `cursorWidth` | `number` | `2` | 光标宽度 |
| `selectionColor` | `string` | `'rgba(17,119,255,0.3)'` | 选区高亮色 |
| `onEditingEntered` | `() => void` | - | 进入编辑时回调 |
| `onEditingExited` | `() => void` | - | 退出编辑时回调 |

#### 样式范围 `IStyleRange`

与 Figma 风格一致，按字符索引区间设置样式：

```ts
interface IStyleRange {
  start: number   // 起始索引（含）
  end: number     // 结束索引（不含）
  
  // 基础样式
  fontSize?: number
  fontFamily?: string
  fontWeight?: IFontWeight
  fill?: IFill
  stroke?: IStroke
  strokeWidth?: number
  strokeAlign?: 'inside' | 'center' | 'outside'
  strokeCap?: 'none' | 'round' | 'square'
  strokeJoin?: 'miter' | 'bevel' | 'round'
  dashPattern?: number[]
  dashOffset?: number
  italic?: boolean
  
  // 文本格式
  textCase?: ITextCase
  textDecoration?: ITextDecoration
  letterSpacing?: number | IUnitData
  textBackgroundColor?: string
  
  // 阴影效果
  shadow?: IShadowEffect | IShadowEffect[]
  innerShadow?: IShadowEffect | IShadowEffect[]

  // 兼容旧属性
  underline?: boolean
  linethrough?: boolean
}
```

#### 字符样式 `ICharStyle`

选区或单字符可用的样式字段（均为可选）：

```ts
interface ICharStyle {
  // 基础样式
  fill?: IFill
  stroke?: IStroke
  strokeWidth?: number
  strokeAlign?: 'inside' | 'center' | 'outside'
  strokeCap?: 'none' | 'round' | 'square'
  strokeJoin?: 'miter' | 'bevel' | 'round'
  dashPattern?: number[]
  dashOffset?: number
  fontSize?: number
  fontFamily?: string
  fontWeight?: IFontWeight
  italic?: boolean
  
  // 文本格式
  textCase?: ITextCase           // 大小写：none/upper/lower/title
  textDecoration?: ITextDecoration  // 装饰线：none/under/delete/under-delete
  letterSpacing?: number | IUnitData  // 字间距
  textBackgroundColor?: string

  // 阴影效果
  shadow?: IShadowEffect | IShadowEffect[]
  innerShadow?: IShadowEffect | IShadowEffect[]
  
  // 兼容旧属性（自动转换为 textDecoration）
  underline?: boolean
  linethrough?: boolean
}
```

#### 类型定义

```ts
// 大小写
type ITextCase = 'title' | 'upper' | 'lower' | 'none'

// 装饰线
type ITextDecoration = ITextDecorationType | ITextDecorationData
type ITextDecorationType = 'none' | 'under' | 'delete' | 'under-delete'

interface ITextDecorationData {
  type: ITextDecorationType
  color: string  // 装饰线颜色
  offset?: number  // 下划线偏移
}

// 单位数据
interface IUnitData {
  type: 'percent' | 'px'
  value: number
}

// 文本对齐
type ITextAlign = 'left' | 'center' | 'right' | 'justify' | 'justify-letter' | 'both' | 'both-letter'

// 换行规则
type ITextWrap = 'normal' | 'none' | 'break'

// 溢出处理
type IOverflow = 'show' | 'hide' | string  // 字符串为自定义省略符

// 阴影效果（与 Leafer ILeafShadowEffect 对齐）
interface IShadowEffect {
  color?: string          // 阴影颜色，支持 rgba/hex
  blur?: number           // 模糊半径，默认 0
  x?: number              // X 方向偏移，默认 0
  y?: number              // Y 方向偏移，默认 0
  spread?: number         // 扩散值，以文本框中心整体缩放阴影（>0 放大，<0 缩小）
  blendMode?: string      // 混合模式，如 'normal', 'multiply' 等
}
```

---

### 实例属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 文本内容，可读写 |
| `isEditing` | `boolean` | 是否处于编辑状态 |
| `selectionStart` | `number` | 选区起始索引（线性字符下标，含） |
| `selectionEnd` | `number` | 选区结束索引（线性字符下标，不含） |

#### selectionStart / selectionEnd 用法与实时性

- **含义**：与原生 `input/textarea` 的 `selectionStart`、`selectionEnd` 一致，表示**线性字符索引**（0 为第一个字符，换行算一个字符）。`selectionStart === selectionEnd` 表示光标位置，不等表示选区范围。
- **是否实时更新**：**是**。内部在以下情况会同步并重绘：
  - **画布上点击/拖拽**：根据点击位置计算索引，写入 `selectionStart`/`selectionEnd`，并 `forceRender()`，画布上的选区高亮和光标会立即更新（类似 Leafer 框选的高亮）。
  - **键盘**：方向键、Home/End、Shift+方向键等在 `keydown` 里更新索引并 `forceRender()`。
  - **输入/删除**：`input` 事件里从隐藏的 textarea 同步到 RichText，再 `forceRender()`。
- **读写**：可直接读写这两个字段；**写**时修改的是“当前选区/光标”，画布会在下一次渲染时体现（内部逻辑在修改后都会调用 `forceRender()`，无需外部再调）。
- **示例**：
  ```ts
  // 读取：当前选区/光标
  const start = richtext.selectionStart
  const end = richtext.selectionEnd
  const selectedText = richtext.text.slice(start, end)

  // 写入：设置选区（需在编辑状态下），改完后需 forceRender 才能更新画布
  richtext.selectionStart = 0
  richtext.selectionEnd = 5
  richtext.forceRender()
  ```

---

### 实例方法

| 方法 | 说明 |
|------|------|
| `enterEditing(cursorPosition?: number)` | 进入编辑模式，可选传入初始光标索引 |
| `exitEditing()` | 退出编辑模式 |
| `refocus()` | 编辑状态下将焦点拉回内部输入（如点完面板按钮后调用） |
| `setSelectionStyles(style: Partial<ICharStyle>)` | 为当前选区设置样式（需有选区） |
| `setFullTextStyles(style: Partial<ICharStyle>)` | 为整段文本设置样式，只修改指定属性，保留其他样式差异 |
| `getSelectionStyles(): ICharStyle[]` | 获取当前选区各字符的样式数组 |
| `getStyleAt(index: number): ICharStyle` | 获取指定位置的字符样式 |
| `clearSelectionStyles()` | 清除当前选区的字符级样式，恢复为基础样式 |
| `clearFullTextStyles()` | 清除整段文本的字符级样式 |
| `selectAll()` | 全选 |
| `undo()` / `redo()` | 撤销 / 重做 |
| `toJSON()` | 导出 JSON，包含 `styleRanges`（与 Figma 风格一致） |

---

### 导出与导入

- **导出**：`richtext.toJSON()` 得到含 `styleRanges` 的对象，可与其他 Leafer 属性一并序列化。
- **导入**：`new RichText({ ...json, styleRanges: json.styleRanges })` 即可还原文本与按范围样式；也支持旧版 `styles` 格式。

示例：

```ts
// 导出
const json = richtext.toJSON()

// 导入
const clone = new RichText({
  ...json,
  styleRanges: json.styleRanges
})
app.tree.add(clone)
```

---

## 项目结构

```
leafer-x-richText/
├── src/
│   ├── richtext/
│   │   ├── index.ts        # 插件入口与 install
│   │   ├── RichText.ts     # 主元素
│   │   ├── RichTextEditor.ts  # 内部编辑器（Leafer Editor 用）
│   │   ├── RichTextData.ts
│   │   ├── EditingManager.ts
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   └── utils.ts
│   └── main.ts             # Demo 入口
├── package.json
└── README.md
```


MIT
