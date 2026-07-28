'use strict'

// Electron 없이 다운로드 로직만 확인하는 스모크 테스트.
//   node test.js "<재생목록 또는 영상 URL>" [포맷] [저장경로]

const os = require('os')
const { downloadPlaylist } = require('./src/downloader')

const [, , url, format = 'mp3', destination = os.tmpdir()] = process.argv

if (!url) {
  console.error('사용법: node test.js "<재생목록 또는 영상 URL>" [포맷] [저장경로]')
  process.exit(1)
}

const emit = (channel, payload) => {
  if (channel === 'download:log') console.log(`[${payload.level}] ${payload.message}`)
}

downloadPlaylist({ playlistUrl: url, format, destination }, emit)
  .then((summary) => {
    console.log(summary)
    process.exitCode = summary.failed > 0 ? 1 : 0
  })
  .catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
