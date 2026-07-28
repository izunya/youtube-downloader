'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// 렌더러에 노출되는 유일한 API. 여기 없는 기능은 렌더러에서 쓸 수 없다.
contextBridge.exposeInMainWorld('api', {
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),

  openHelp: () => ipcRenderer.invoke('app:open-help'),

  /** @param {{playlistUrl: string, format: string, destination: string}} options */
  startDownload: (options) => ipcRenderer.invoke('download:start', options),

  /** @param {(entry: {level: 'info' | 'error', message: string}) => void} callback */
  onLog: (callback) => {
    const listener = (_event, entry) => callback(entry)
    ipcRenderer.on('download:log', listener)
    return () => ipcRenderer.off('download:log', listener)
  },

  /** @param {(p: {index: number, total: number, percent: number}) => void} callback */
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('download:progress', listener)
    return () => ipcRenderer.off('download:progress', listener)
  }
})
