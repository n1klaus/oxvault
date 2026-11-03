import { dialog, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import type {
  ItemDetail,
  ItemMenuAction,
  MenuPosition,
  NativeConfirmation,
} from '@oxvault/shared/types';

const confirmations: Record<
  NativeConfirmation,
  { message: string; detail: string; buttons: [string, string] }
> = {
  trash: {
    message: 'Move this item to Trash?',
    detail: 'You can restore it from Trash. This does not delete it permanently.',
    buttons: ['Cancel', 'Move to Trash'],
  },
  discard: {
    message: 'Discard changes?',
    detail: 'Your unsaved changes will be lost.',
    buttons: ['Keep editing', 'Discard changes'],
  },
  deleteFolder: {
    message: 'Delete this folder?',
    detail: 'Its items move to No folder. They are not deleted.',
    buttons: ['Cancel', 'Delete folder'],
  },
  deleteSend: {
    message: 'Delete this Send?',
    detail: 'Its link stops working for everyone, and the Send cannot be restored.',
    buttons: ['Cancel', 'Delete Send'],
  },
  deleteAttachment: {
    message: 'Delete this attachment?',
    detail: 'The file is removed from Bitwarden and cannot be restored.',
    buttons: ['Cancel', 'Delete attachment'],
  },
};

export function installNativeInteractions(window: BrowserWindow) {
  let confirmation: AbortController | undefined;
  let dismissMenu: (() => void) | undefined;
  const cancelMenu = () => dismissMenu?.();
  window.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable && !params.selectionText) return;
    const { editFlags } = params;
    const secret = params.formControlType === 'input-password';
    const template: MenuItemConstructorOptions[] = params.isEditable
      ? [
          { role: 'undo', enabled: editFlags.canUndo },
          { role: 'redo', enabled: editFlags.canRedo },
          { type: 'separator' },
          { role: 'cut', enabled: !secret && editFlags.canCut },
          { role: 'copy', enabled: !secret && editFlags.canCopy },
          { role: 'paste', enabled: editFlags.canPaste },
          { type: 'separator' },
          { role: 'selectAll', enabled: editFlags.canSelectAll },
        ]
      : [{ role: 'copy', enabled: editFlags.canCopy }];
    cancelMenu();
    const menu = Menu.buildFromTemplate(template);
    const dismiss = () => {
      if (dismissMenu === dismiss) dismissMenu = undefined;
      if (!window.isDestroyed()) menu.closePopup(window);
    };
    dismissMenu = dismiss;
    menu.popup({
      window,
      frame: params.frame ?? undefined,
      callback: () => {
        if (dismissMenu === dismiss) dismissMenu = undefined;
      },
    });
  });
  const cancelConfirmation = () => confirmation?.abort();
  window.on('hide', cancelConfirmation);
  window.once('closed', cancelConfirmation);
  window.on('hide', cancelMenu);
  window.once('closed', cancelMenu);
  window.webContents.on('did-start-navigation', cancelMenu);
  return {
    cancelConfirmation,
    cancelMenu,
    itemMenu(item: ItemDetail, position: MenuPosition): Promise<ItemMenuAction | null> {
      cancelMenu();
      if (confirmation || window.isDestroyed() || !window.isVisible()) return Promise.resolve(null);
      return new Promise((resolve) => {
        let action: ItemMenuAction | null = null;
        const entry = (
          label: string,
          value: ItemMenuAction,
          enabled = true,
        ): MenuItemConstructorOptions => ({
          label,
          enabled,
          click: () => {
            action = value;
          },
        });
        const template: MenuItemConstructorOptions[] = [];
        if (item.type === 1) {
          template.push(entry('Copy Username', 'copyUsername', !!item.username));
          template.push(entry('Copy Password', 'copyPassword', !!item.password));
          template.push({ type: 'separator' });
        }
        if (item.type === 3) {
          template.push(entry('Copy Number', 'copyCardNumber', !!item.card?.number));
          template.push(entry('Copy Security Code', 'copyCardCode', !!item.card?.code));
          template.push({ type: 'separator' });
        }
        template.push(entry('Edit', 'edit', item.editable));
        if (item.restorable) template.push(entry('Restore to Vault', 'restore'));
        else template.push(entry('Move to Trash…', 'trash', item.deletable));
        const menu = Menu.buildFromTemplate(template);
        const dismiss = () => {
          if (dismissMenu === dismiss) dismissMenu = undefined;
          resolve(null);
          if (!window.isDestroyed()) menu.closePopup(window);
        };
        dismissMenu = dismiss;
        const [width = 1, height = 1] = window.getContentSize();
        menu.popup({
          window,
          x: Math.min(position.x, width - 1),
          y: Math.min(position.y, height - 1),
          callback: () => {
            if (dismissMenu === dismiss) dismissMenu = undefined;
            resolve(action);
          },
        });
      });
    },
    /** Opens a native file picker for a file Send. Resolves null when it is cancelled. */
    async chooseOpenPath(): Promise<string | null> {
      if (confirmation || window.isDestroyed() || !window.isVisible()) return null;
      const result = await dialog.showOpenDialog(window, {
        title: 'Choose a file to share',
        properties: ['openFile'],
      });
      const [picked] = result.filePaths;
      if (result.canceled || picked === undefined) return null;
      return picked;
    },
    /** Opens a native file picker for an attachment. Resolves null when it is cancelled. */
    async chooseAttachmentPath(): Promise<string | null> {
      if (confirmation || window.isDestroyed() || !window.isVisible()) return null;
      const result = await dialog.showOpenDialog(window, {
        title: 'Choose a file to attach',
        properties: ['openFile'],
      });
      const [picked] = result.filePaths;
      if (result.canceled || picked === undefined) return null;
      return picked;
    },
    /** Opens a native save dialog for an attachment. Resolves null when it is cancelled. */
    async chooseSavePath(fileName: string): Promise<string | null> {
      if (confirmation || window.isDestroyed() || !window.isVisible()) return null;
      const result = await dialog.showSaveDialog(window, {
        title: 'Save attachment',
        defaultPath: fileName || undefined,
      });
      if (result.canceled || !result.filePath) return null;
      return result.filePath;
    },
    async confirm(action: NativeConfirmation) {
      if (confirmation || window.isDestroyed() || !window.isVisible()) return false;
      const controller = new AbortController();
      confirmation = controller;
      try {
        const { message, detail, buttons } = confirmations[action];
        const result = await dialog.showMessageBox(window, {
          type: 'warning',
          message,
          detail,
          buttons,
          defaultId: 0,
          cancelId: 0,
          noLink: true,
          signal: controller.signal,
        });
        return !controller.signal.aborted && result.response === 1;
      } finally {
        confirmation = undefined;
      }
    },
  };
}
