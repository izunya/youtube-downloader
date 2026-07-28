'use strict'

// 렌더러에는 Node API가 없다. 모든 작업은 preload가 노출한 window.api로 요청한다.

const form = document.getElementById('download-form')
const playlistUrlInput = document.getElementById('playlistUrl')
const formatSelect = document.getElementById('format')
const destinationInput = document.getElementById('destination')
const startButton = document.getElementById('download')
const progressRow = document.getElementById('progress-row')
const progressBar = document.getElementById('progress')
const progressLabel = document.getElementById('progress-label')
const helpButton = document.getElementById('help')
const clearLogButton = document.getElementById('clear-log')

const setBusy = (busy) => {
  startButton.disabled = busy
  startButton.textContent = busy ? 'Downloading...' : 'Start Download'
  startButton.classList.toggle('is-busy', busy)
  progressRow.hidden = !busy

  if (busy) {
    progressBar.value = 0
    progressLabel.textContent = '준비 중'
  }
}

helpButton.addEventListener('click', () => window.api.openHelp())
clearLogButton.addEventListener('click', () => window.log.clearLog())

// 다운로드 경로는 OS 기본 폴더 선택 대화상자로 고른다.
destinationInput.addEventListener('click', async () => {
  const directory = await window.api.selectDirectory()
  if (directory) destinationInput.value = directory
})

window.api.onLog(({ level, message }) => window.log.add(level, message))

window.api.onProgress(({ index, total, percent }) => {
  progressBar.value = percent
  progressLabel.textContent = total > 1 ? `${index + 1}/${total} · ${percent}%` : `${percent}%`
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  if (!destinationInput.value) {
    window.log.addErrorLog('다운로드 경로를 선택해주세요.')
    return
  }

  setBusy(true)
  window.log.addLog('다운로드를 시작합니다.')

  try {
    const result = await window.api.startDownload({
      playlistUrl: playlistUrlInput.value.trim(),
      format: formatSelect.value,
      destination: destinationInput.value
    })

    if (!result.ok) window.log.addErrorLog(result.message)
  } catch (err) {
    window.log.addErrorLog(`예상치 못한 오류가 발생했습니다: ${err.message}`)
  } finally {
    setBusy(false)
  }
})
