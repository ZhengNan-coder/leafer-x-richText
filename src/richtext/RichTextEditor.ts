// RichTextEditor - RichText 的内部编辑器
// 集成 Leafer Editor，实现"选中元素 -> 双击进入编辑"的标准流程

import { InnerEditor, registerInnerEditor } from '@leafer-in/editor'
import type { RichText } from './RichText'

@registerInnerEditor()
export class RichTextEditor extends InnerEditor {
  public get tag() { return 'RichTextEditor' }
  
  declare public editTarget: RichText
  
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
      })
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
    
    // 退出 RichText 的编辑模式
    if (richtext.isEditing) {
      richtext.exitEditing()
    }
    
    // 清理事件监听
    if (this.eventIds) {
      this.eventIds.forEach(id => this.editor.app.off_(id))
      this.eventIds = []
    }
  }
}
