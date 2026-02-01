// RichTextEditor - RichText 的内部编辑器
// 集成 Leafer Editor，实现"选中元素 -> 双击进入编辑"的标准流程

import { InnerEditor, registerInnerEditor } from '@leafer-in/editor'
import type { RichText } from './RichText'

@registerInnerEditor()
export class RichTextEditor extends InnerEditor {
  public get tag() { return 'RichTextEditor' }
  
  declare public editTarget: RichText
  
  // 保存 Editor 配置（用于恢复）
  private _savedEditorConfig: any
  
  /**
   * 加载时（双击进入编辑）
   */
  public onLoad(): void {
    const richtext = this.editTarget
    const { editor } = this
    
    // 进入 RichText 的编辑模式（不设置光标位置，让双击事件处理）
    if (!richtext.isEditing) {
      richtext.enterEditing()
    }
    
    // ✅ 方案1：禁用 Editor 的键盘快捷键（防止方向键移动元素）
    this._savedEditorConfig = {
      hotkey: editor.config.hotkey,
      keyEvent: (editor as any).keyEvent
    }
    editor.config.hotkey = false
    
    // ⚠️ 不使用 locked，允许拖动边框调整尺寸（符合 Figma 行为）
    // locked 会禁用所有变换操作，包括拖动边框调整尺寸
    
    // ✅ 方案2：临时禁用 Editor 的键盘事件处理器
    if ((editor as any).keyEvent) {
      (editor as any).keyEvent.disable?.()
    }
    
    // 重要：让 RichText 能接收 pointer 事件
    // Editor 在 innerEditing 时会停止事件传播，需要手动转发
    this.eventIds = [
      // 监听整个应用的 pointer.down
      editor.app.on_('pointer.down' as any, (e: any) => {
        // 使用坐标+边界判断是否点击在文本上
        // 获取点击的世界坐标
        const worldPoint = { x: e.x, y: e.y }
        
        // 使用 RichText 的 hit 方法判断
        const clickedOnText = richtext.hit(worldPoint)
        
        if (clickedOnText) {
          richtext._handlePointerDown(e)
        } else {
          editor.closeInnerEditor()
        }
      }),
      
      // 监听 pointer.move（用于拖拽选区）
      editor.app.on_('pointer.move' as any, (e: any) => {
        if (richtext.isEditing) {
          // 在编辑状态下，总是转发 move 事件（用于拖拽选区）
          richtext._handlePointerMove(e)
        }
      }),
      
      editor.app.on_('pointer.up' as any, (e: any) => {
        if (richtext.isEditing) {
          richtext._handlePointerUp(e)
        }
      }),
      
      // ✅ 拦截键盘事件，防止 Editor 处理（避免方向键移动元素）
      editor.app.on_('key.down' as any, (e: any) => {
        if (richtext.isEditing) {
          // 在编辑状态下，阻止键盘事件传递到 Editor
          // Leafer API: 使用 stop() 代替 stopPropagation()
          if (e.stop) e.stop()
          if (e.stopDefault) e.stopDefault()
        }
      }, { capture: true })  // 使用捕获阶段拦截
    ]
  }
  
  /**
   * 更新位置（元素移动/缩放时）
   */
  public onUpdate(): void {
    // RichText 自己管理渲染，不需要更新 DOM 位置
  }
  
  /**
   * 卸载时（退出编辑）
   */
  public onUnload(): void {
    const richtext = this.editTarget
    const { editor } = this
    
    // 退出 RichText 的编辑模式
    if (richtext.isEditing) {
      richtext.exitEditing()
    }
    
    // ✅ 恢复 Editor 的配置
    if (this._savedEditorConfig) {
      editor.config.hotkey = this._savedEditorConfig.hotkey
      
      // 恢复键盘事件处理器
      if (this._savedEditorConfig.keyEvent && (editor as any).keyEvent) {
        (editor as any).keyEvent.enable?.()
      }
      
      this._savedEditorConfig = null
    }
    
    // 清理事件监听
    if (this.eventIds) {
      this.eventIds.forEach(id => this.editor.app.off_(id))
      this.eventIds = []
    }
  }
}
