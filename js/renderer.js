'use strict'

// 렌더러에는 Node API가 없다. 모든 작업은 preload가 노출한 window.api로 요청한다.

const form = document.getElementById('download-form')
const playlistUrlInput = document.getElementById('playlistUrl')
const formatSelect = document.getElementById('format')
const qualitySelect = document.getElementById('quality')
const destinationInput = document.getElementById('destination')
const startButton = document.getElementById('download')
const progressRow = document.getElementById('progress-row')
const progressBar = document.getElementById('progress')
const progressLabel = document.getElementById('progress-label')
const helpButton = document.getElementById('help')
const clearLogButton = document.getElementById('clear-log')

// 형식마다 고를 수 있는 품질이 다르다. src/downloader.js의 목록과 맞춰야 한다.
const VIDEO_QUALITIES = [
  { value: '360', label: '360p' },
  { value: '480', label: '480p' },
  { value: '720', label: '720p' },
  { value: '1080', label: '1080p' },
  { value: '1440', label: '1440p' }
]
const AUDIO_QUALITIES = [
  { value: '128', label: '128 kbps' },
  { value: '192', label: '192 kbps' },
  { value: '256', label: '256 kbps' },
  { value: '320', label: '320 kbps' }
]
const AUDIO_FORMATS = new Set(['mp3', 'm4a', 'wav', 'flac', 'ogg'])
const LOSSLESS_FORMATS = new Set(['wav', 'flac'])
const DEFAULTS = { video: '1080', audio: '320' }

// 형식을 바꿔도 같은 품질을 고르고 있었다면 그대로 유지한다.
const fillQualityOptions = () => {
  const format = formatSelect.value
  const previous = qualitySelect.value

  if (LOSSLESS_FORMATS.has(format)) {
    qualitySelect.replaceChildren(new Option('원본 무손실', ''))
    qualitySelect.disabled = true
    return
  }

  const audio = AUDIO_FORMATS.has(format)
  const options = audio ? AUDIO_QUALITIES : VIDEO_QUALITIES
  qualitySelect.replaceChildren(...options.map((o) => new Option(o.label, o.value)))
  qualitySelect.disabled = false
  qualitySelect.value = options.some((o) => o.value === previous)
    ? previous
    : DEFAULTS[audio ? 'audio' : 'video']
}

const setBusy = (busy) => {
  startButton.disabled = busy
  startButton.textContent = busy ? 'Downloading...' : 'Start Download'
  startButton.classList.toggle('is-busy', busy)
  formatSelect.disabled = busy
  qualitySelect.disabled = busy || LOSSLESS_FORMATS.has(formatSelect.value)
  progressRow.hidden = !busy

  if (busy) {
    progressBar.value = 0
    progressLabel.textContent = '준비 중'
  }
}

helpButton.addEventListener('click', () => window.api.openHelp())
clearLogButton.addEventListener('click', () => window.log.clearLog())
formatSelect.addEventListener('change', fillQualityOptions)
fillQualityOptions()

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
      quality: qualitySelect.value,
      destination: destinationInput.value
    })

    if (!result.ok) window.log.addErrorLog(result.message)
  } catch (err) {
    window.log.addErrorLog(`예상치 못한 오류가 발생했습니다: ${err.message}`)
  } finally {
    setBusy(false)
  }
})
