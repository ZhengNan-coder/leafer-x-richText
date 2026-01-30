// EditingManager - 全局编辑管理器
// 确保同一时间只有一个 RichText 实例在编辑状态

import type { RichText } from './RichText'

export class EditingManager {
  private static activeEditor: RichText | null = null
  
  /**
   * 请求进入编辑模式
   * 如果有其他实例正在编辑，会先退出
   */
  static requestEditing(editor: RichText): void {
    if (EditingManager.activeEditor && EditingManager.activeEditor !== editor) {
      EditingManager.activeEditor.exitEditing()
    }
    EditingManager.activeEditor = editor
  }
  
  /**
   * 清除活动编辑器
   */
  static clearActive(editor: RichText): void {
    if (EditingManager.activeEditor === editor) {
      EditingManager.activeEditor = null
    }
  }
  
  /**
   * 获取当前活动编辑器
   */
  static getActive(): RichText | null {
    return EditingManager.activeEditor
  }
}
