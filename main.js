'use strict'

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron')
const path = require('path')

const { downloadPlaylist } = require('./src/downloader')

const HELP_URL = 'https://github.com/izunya/youtube-downloader'

let downloadInProgress = false

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 680,
    height: 760,
    minWidth: 460,
    minHeight: 600,
    show: false,
    // 첫 페인트 전까지 흰 화면이 번쩍이지 않도록 배경을 미리 맞춰둔다.
    backgroundColor: '#080b14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Electron 12+의 기본값. 렌더러에서 Node API를 쓰지 않고
      // preload가 노출한 window.api만 사용한다.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'index.html'))
  mainWindow.once('ready-to-show', () => mainWindow.show())

  // 새 창을 띄우는 대신 기본 브라우저로 연다.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // 개발자 도구를 연다.
  // mainWindow.webContents.openDevTools()
}

app.whenReady().then(() => {
  // File/Edit/View/Window 기본 메뉴바를 없앤다.
  Menu.setApplicationMenu(null)

  createWindow()

  app.on('activate', () => {
    // macOS에서는 독 아이콘을 눌렀을 때 창이 없으면 다시 만든다.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // macOS에서는 사용자가 Cmd + Q로 직접 종료할 때까지 앱을 유지한다.
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('dialog:select-directory', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    title: '다운로드 경로 선택',
    properties: ['openDirectory', 'createDirectory']
  })
  return canceled ? null : filePaths[0]
})

ipcMain.handle('app:open-help', () => {
  // 렌더러가 임의의 URL을 열 수 없도록 주소는 메인 프로세스에서 고정한다.
  shell.openExternal(HELP_URL)
})

ipcMain.handle('download:start', async (event, options) => {
  if (downloadInProgress) {
    return { ok: false, message: '이미 다운로드가 진행 중입니다.' }
  }
  downloadInProgress = true

  const emit = (channel, payload) => {
    if (!event.sender.isDestroyed()) event.sender.send(channel, payload)
  }

  try {
    const summary = await downloadPlaylist(options, emit)
    return { ok: true, summary }
  } catch (err) {
    return { ok: false, message: err.message }
  } finally {
    downloadInProgress = false
  }
})
