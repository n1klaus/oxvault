import { contextBridge, ipcRenderer } from 'electron';
import type { VaultApi, VaultState, WindowCommand, WindowAppearance } from '@oxvault/shared/types';
import type { DesktopRequest } from '@oxvault/shared/protocol';

const request = (message: DesktopRequest) => ipcRenderer.invoke('oxvault:request', message);

const api: VaultApi = {
  platform: process.platform,
  lockTimeout: () => request({ type: 'lockTimeout' }),
  setLockTimeout: (minutes) => request({ type: 'setLockTimeout', minutes }),
  macAutoFill: () => request({ type: 'macAutoFill' }),
  enableMacAutoFill: () => request({ type: 'enableMacAutoFill' }),
  macAutoFillSettings: () => request({ type: 'macAutoFillSettings' }),
  websiteIcons: () => request({ type: 'websiteIcons' }),
  setWebsiteIcons: (enabled) => request({ type: 'setWebsiteIcons', enabled }),
  websiteIcon: (id) => request({ type: 'websiteIcon', id }),
  confirm: (action) => request({ type: 'confirm', action }),
  itemMenu: (id, position) => request({ type: 'itemMenu', id, position }),
  state: () => request({ type: 'state' }),
  login: (input) => request({ type: 'login', input }),
  answerChallenge: (answer) => request({ type: 'challenge', answer }),
  unlock: (password) => request({ type: 'unlock', password }),
  unlockWithBiometrics: () => request({ type: 'biometricUnlock' }),
  setBiometrics: (enabled) => request({ type: 'setBiometrics', enabled }),
  lock: () => request({ type: 'lock' }),
  logout: () => request({ type: 'logout' }),
  sync: () => request({ type: 'sync' }),
  items: () => request({ type: 'items' }),
  trash: () => request({ type: 'trash' }),
  folders: () => request({ type: 'folders' }),
  sharing: () => request({ type: 'sharing' }),
  generateSshKey: () => request({ type: 'generateSshKey' }),
  importSshKey: (privateKey) => request({ type: 'importSshKey', privateKey }),
  saveFolder: (id, name) => request({ type: 'saveFolder', id, name }),
  deleteFolder: (id) => request({ type: 'deleteFolder', id }),
  detail: (id) => request({ type: 'detail', id }),
  totp: (id) => request({ type: 'totp', id }),
  copyTotp: (id) => request({ type: 'copyTotp', id }),
  openProtected: (id, password) => request({ type: 'openProtected', id, password }),
  closeProtected: (id) => request({ type: 'closeProtected', id }),
  save: (draft) => request({ type: 'save', draft }),
  setFavorite: (id, favorite) => request({ type: 'setFavorite', id, favorite }),
  remove: (id) => request({ type: 'delete', id }),
  restore: (id) => request({ type: 'restore', id }),
  copy: (id, field) => request({ type: 'copy', id, field }),
  generate: (options) => request({ type: 'generate', options }),
  browserSetup: () => request({ type: 'browserSetup' }),
  connectBrowser: (browser) => request({ type: 'connectBrowser', browser }),
  browserConnection: () => request({ type: 'browserConnection' }),
  openExtensionFolder: () => request({ type: 'openExtensionFolder' }),
  onState: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: VaultState) => listener(state);
    ipcRenderer.on('oxvault:state', handler);
    return () => ipcRenderer.removeListener('oxvault:state', handler);
  },
  appearance: () => request({ type: 'appearance' }),
  onAppearance: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, value: WindowAppearance) => listener(value);
    ipcRenderer.on('oxvault:appearance', handler);
    return () => ipcRenderer.removeListener('oxvault:appearance', handler);
  },
  onCommand: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, command: WindowCommand) => {
      if (command === 'search' || command === 'new' || command === 'settings') listener(command);
    };
    ipcRenderer.on('oxvault:command', handler);
    return () => ipcRenderer.removeListener('oxvault:command', handler);
  },
  sends: () => request({ type: 'sends' }),
  createSend: (draft) => request({ type: 'createSend', draft }),
  deleteSend: (id) => request({ type: 'deleteSend', id }),
  removeSendPassword: (id) => request({ type: 'removeSendPassword', id }),
  copySendLink: (id) => request({ type: 'copySendLink', id }),
  addAttachment: (id) => request({ type: 'addAttachment', id }),
  downloadAttachment: (id, attachmentId) =>
    request({ type: 'downloadAttachment', id, attachmentId }),
  deleteAttachment: (id, attachmentId) => request({ type: 'deleteAttachment', id, attachmentId }),
};

contextBridge.exposeInMainWorld('oxvault', api);
