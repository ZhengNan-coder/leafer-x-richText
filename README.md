# leafer-x-richText

Leafer 富文本插件：支持按字符设置样式的可编辑文本元素，行为类似 Fabric.js IText，导出格式兼容 Figma 的 `styleRanges`。

## 特性

- **按字符样式**：选中文字后可单独设置颜色、字体、字号、粗体、斜体、下划线、删除线、背景色
- **完整编辑**：光标、选区、输入法、复制粘贴、撤销重做
- **交互**：单击选中、双击进入编辑/选词、三击选行、拖拽选区
- **键盘**：方向键、Home/End、Ctrl+A/C/V/X/Z/Y、Ctrl+左右按词移动
- **序列化**：`toJSON()` 导出含 `styleRanges` 的 JSON，构造时支持 `styleRanges` 导入

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

const richtext = new RichText({
  x: 100,
  y: 100,
  text: '可编辑富文本',
  fontSize: 24,
  fill: '#333',
  editable: true
})

app.tree.add(richtext)
```

- **单击**文本：选中元素（由 Leafer Editor 处理）
- **双击**文本：进入编辑模式，可输入、选区、设置样式
- **ESC 或点击画布空白**：退出编辑

## 使用说明

1. 进入编辑：双击文本（或代码中调用 `richtext.enterEditing()`）
2. 选区：在编辑状态下拖拽或 Shift+方向键
3. 设置样式：选区后调用 `richtext.setSelectionStyles({ fill, fontSize, fontWeight, ... })`
4. 退出编辑：ESC 或点击空白（或 `richtext.exitEditing()`）

与 Leafer Editor 配合时，内部编辑器名称为 `RichTextEditor`，RichText 通过 `editInner: 'RichTextEditor'` 与之绑定（已内置）。

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

| 属性 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 文本内容 |
| `x`, `y` | `number` | 位置 |
| `fontSize` | `number` | 默认字号，默认 16 |
| `fontFamily` | `string` | 默认字体 |
| `fontWeight` | `'normal' \| 'bold' \| number` | 默认字重 |
| `fill` | `string` | 默认填充色 |
| `italic` | `boolean` | 默认是否斜体 |
| `editable` | `boolean` | 是否可编辑，默认 true |
| `width` | `number` | 可选固定宽度（自动换行） |
| `cursorColor` | `string` | 光标颜色 |
| `cursorWidth` | `number` | 光标宽度 |
| `selectionColor` | `string` | 选区高亮色 |
| `styleRanges` | `IStyleRange[]` | 按范围设置的样式（推荐，与 toJSON 一致） |
| `styles` | `object` | 旧版按行/字索引的样式（兼容） |
| `onEditingEntered` | `() => void` | 进入编辑时回调 |
| `onEditingExited` | `() => void` | 退出编辑时回调 |

#### 样式范围 `IStyleRange`

与 Figma 风格一致，按字符索引区间设置样式：

```ts
interface IStyleRange {
  start: number   // 起始索引（含）
  end: number     // 结束索引（不含）
  fontSize?: number
  fontFamily?: string
  fontWeight?: 'normal' | 'bold' | number
  fill?: string
  italic?: boolean
  underline?: boolean
  linethrough?: boolean
  textBackgroundColor?: string
}
```

#### 字符样式 `ICharStyle`

选区或单字符可用的样式字段（均为可选）：

```ts
interface ICharStyle {
  fill?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: 'normal' | 'bold' | number
  italic?: boolean
  underline?: boolean
  linethrough?: boolean
  textBackgroundColor?: string
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
| `getSelectionStyles(): ICharStyle[]` | 获取当前选区各字符的样式数组 |
| `clearSelectionStyles()` | 清除当前选区的字符级样式，恢复为默认 |
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

## 发布到公共 npm（避免发到公司源）

本项目已做两处配置，保证发布到 **https://registry.npmjs.org/**：

1. **项目根目录的 `.npmrc`**  
   内容为 `registry=https://registry.npmjs.org/`，只对本项目生效。在本目录下执行 `npm install` / `npm publish` 都会走公共 npm。

2. **推荐：用脚本发布**（不依赖 .npmrc，最稳）  
   ```bash
   npm run publish:public
   ```
   会先构建再执行 `npm publish --registry https://registry.npmjs.org/ --access public`。

**发布前**请先登录公共 npm（若未登录）：
```bash
npm login
# 使用 https://www.npmjs.com 的账号
```

然后在本项目根目录执行：
```bash
npm run publish:public
# 或
npm publish
```

## License

MIT
