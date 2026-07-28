'use strict'

// 다운로드 로직은 전부 메인 프로세스에서 실행된다.
// 렌더러는 contextBridge(preload.js)를 통해서만 이 기능을 호출할 수 있다.
//
// 실제 다운로드는 yt-dlp(youtube-dl-exec가 설치해주는 바이너리)가 담당한다.
// 유튜브가 플레이어 스크립트를 자주 바꾸기 때문에, 직접 스트림 URL을 해석하는
// ytdl-core 계열 라이브러리는 더 이상 동작하지 않는다.

const fsp = require('fs/promises')
const path = require('path')
const ffmpegStatic = require('ffmpeg-static')
const { create, constants } = require('youtube-dl-exec')

// asar로 패키징하면 바이너리는 app.asar.unpacked 쪽에 풀려 있으므로 경로를 바꿔준다.
const unpacked = (binaryPath) => binaryPath.replace('app.asar', 'app.asar.unpacked')

// ffmpeg-static v5부터는 모듈이 바이너리 경로 문자열을 그대로 export 한다.
// 지원하지 않는 플랫폼/아키텍처에서는 null을 반환하므로 확인이 필요하다.
if (!ffmpegStatic) {
  throw new Error(`ffmpeg를 지원하지 않는 환경입니다: ${process.platform}/${process.arch}`)
}
const ffmpegPath = unpacked(ffmpegStatic)
const ytdlpPath = unpacked(constants.YOUTUBE_DL_PATH)
const ytdlp = create(ytdlpPath)

// 컨테이너가 아니라 오디오만 필요한 포맷들
const AUDIO_ONLY_FORMATS = new Set(['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus'])

// yt-dlp의 --audio-format 이름이 확장자와 다른 경우.
// ogg를 그대로 넘기면 "invalid audio format" 오류가 나고, vorbis가 .ogg 파일을 만든다.
const YTDLP_AUDIO_FORMAT = { ogg: 'vorbis' }

// yt-dlp의 출력에서 진행률과 확장자를 구분하기 위한 표식
const PROGRESS_PREFIX = '@@progress'
const EXT_PREFIX = '@@ext'

// 소리만 제공하는 사이트. mp4 같은 영상 포맷을 고르면 미리 알려준다.
const AUDIO_ONLY_HOSTS = ['soundcloud.com', 'snd.sc']

/** URL이 소리만 제공하는 사이트를 가리키는지 확인한다. */
const isAudioOnlySource = (inputUrl) => {
  try {
    const host = new URL(inputUrl).hostname.replace(/^www\./, '')
    return AUDIO_ONLY_HOSTS.some((known) => host === known || host.endsWith(`.${known}`))
  } catch {
    return false // URL로 파싱되지 않으면 판단하지 않는다.
  }
}

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g

/** 제어 문자는 파일 이름에 들어갈 수 없으므로 미리 제거한다. */
const stripControlChars = (value) =>
  Array.from(value)
    .filter((ch) => ch.codePointAt(0) >= 32)
    .join('')

/** \ / : * ? " < > | 는 파일 이름으로 쓸 수 없기 때문에 공백으로 바꾼다. */
const sanitizeFileName = (title) => {
  const cleaned = stripControlChars(title)
    .replace(INVALID_FILENAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    // 윈도우는 이름이 마침표나 공백으로 끝나는 파일을 허용하지 않는다.
    // 마침표를 지우면 그 앞의 공백이 드러나므로 둘을 한 번에 처리한다.
    .replace(/^[. ]+|[. ]+$/g, '')
  return cleaned || 'untitled'
}

/** 같은 제목의 영상이 여러 개일 때 덮어쓰지 않도록 (1), (2)를 붙인다. */
const uniqueBaseName = async (dir, base, ext) => {
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? base : `${base} (${i})`
    try {
      await fsp.access(path.join(dir, `${candidate}.${ext}`))
    } catch {
      return candidate
    }
  }
}

/** 재생목록 URL이면 목록 전체를, 단일 트랙 URL이면 그 트랙 하나를 돌려준다. */
const resolveTracks = async (inputUrl) => {
  let payload
  try {
    payload = await ytdlp(inputUrl, {
      dumpSingleJson: true,
      flatPlaylist: true,
      ignoreErrors: true,
      noWarnings: true
    })
  } catch (err) {
    throw new Error(`목록을 불러오지 못했습니다: ${firstErrorLine(err)}`)
  }

  if (typeof payload !== 'object' || payload === null) {
    throw new Error('유효한 유튜브 / 사운드클라우드 URL이 아닙니다.')
  }

  const entries = payload._type === 'playlist' ? payload.entries || [] : [payload]

  return entries
    // 비공개 / 삭제된 항목은 url이 비어 있으므로 걸러낸다.
    .filter((entry) => entry && (entry.webpage_url || entry.url))
    .map((entry) => ({
      // 단일 항목을 조회하면 url이 만료되는 스트림 주소라서 webpage_url을 우선한다.
      url: entry.webpage_url || entry.url,
      // 사운드클라우드 세트는 flat 모드에서 제목을 주지 않는다.
      // 이때 entry.id는 숫자 트랙 ID라서 파일 이름으로 쓸 수 없다.
      title: entry.title || null
    }))
}

/** flat 모드에서 제목을 받지 못한 항목의 제목을 따로 조회한다. */
const fetchTitle = async (trackUrl) => {
  try {
    const info = await ytdlp(trackUrl, {
      dumpSingleJson: true,
      skipDownload: true,
      noPlaylist: true,
      noWarnings: true
    })
    return info?.title || null
  } catch {
    return null // 제목을 못 구해도 다운로드 자체는 시도한다.
  }
}

/** yt-dlp가 실패했을 때 사용자에게 보여줄 한 줄짜리 이유를 뽑아낸다. */
const firstErrorLine = (err) => {
  const text = (err.stderr || err.message || '').trim()
  const errorLine = text.split('\n').find((line) => line.includes('ERROR:'))
  return (errorLine || text.split('\n').pop() || '알 수 없는 오류').trim()
}

/** 트랙 하나를 받아서 요청한 포맷으로 저장하고, 저장된 경로를 돌려준다. */
const downloadTrack = async (track, destination, format, onProgress) => {
  const audioOnly = AUDIO_ONLY_FORMATS.has(format)
  const title = track.title || (await fetchTitle(track.url)) || 'untitled'
  const base = await uniqueBaseName(destination, sanitizeFileName(title), format)

  // yt-dlp 출력 템플릿에서 %는 특별한 의미를 가지므로 제목에 있는 %는 이스케이프한다.
  const outputTemplate = path.join(destination, `${base.replace(/%/g, '%%')}.%(ext)s`)

  const flags = {
    output: outputTemplate,
    noPlaylist: true,
    noWarnings: true,
    ffmpegLocation: ffmpegPath,
    newline: true,
    progressTemplate: `download:${PROGRESS_PREFIX} %(progress._percent_str)s`,
    // 아래 print 옵션은 yt-dlp에서 --quiet를 함축한다.
    // 그러면 진행률 출력까지 사라지므로 명시적으로 다시 켠다.
    progress: true,
    // 후처리까지 끝난 뒤의 확장자를 yt-dlp에게 물어본다.
    // 소리만 있는 트랙처럼 컨테이너가 달라지는 경우를 미리 계산할 수 없기 때문이다.
    // 경로 전체를 받지 않는 이유는, yt-dlp가 stdout을 콘솔 코드페이지로 인코딩해서
    // 한글·베트남어 같은 문자가 깨져 나오기 때문이다. 확장자는 항상 ASCII라 안전하다.
    print: `after_move:${EXT_PREFIX} %(ext)s`
  }

  if (audioOnly) {
    flags.format = 'bestaudio/best'
    flags.extractAudio = true
    flags.audioFormat = YTDLP_AUDIO_FORMAT[format] || format
  } else {
    // mp4에 av1/opus가 담기면 구형 플레이어에서 재생되지 않는다.
    // H.264 + AAC를 먼저 찾고, 없을 때만 다른 코덱으로 내려간다.
    flags.format = [
      'bv*[vcodec^=avc1]+ba[acodec^=mp4a]',
      'b[vcodec^=avc1][acodec^=mp4a]',
      'bv*[ext=mp4]+ba[ext=m4a]',
      'b[ext=mp4]',
      'bv*+ba/b'
    ].join('/')
    flags.mergeOutputFormat = format
    // 영상 트랙이 없으면 머지가 일어나지 않아 mergeOutputFormat이 무시된다.
    // 사운드클라우드처럼 소리만 있는 경우에도 요청한 컨테이너로 맞춰준다.
    flags.remuxVideo = format
  }

  const subprocess = ytdlp.exec(track.url, flags)
  let reportedExt = null

  if (subprocess.stdout) {
    let buffer = ''
    subprocess.stdout.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() // 잘린 마지막 줄은 다음 chunk와 이어붙인다.
      for (const line of lines) {
        if (line.startsWith(EXT_PREFIX)) {
          const ext = line.slice(EXT_PREFIX.length).trim()
          if (/^[a-z0-9]{2,5}$/i.test(ext)) reportedExt = ext
        } else if (onProgress && line.startsWith(PROGRESS_PREFIX)) {
          const percent = Number.parseFloat(line.slice(PROGRESS_PREFIX.length))
          if (Number.isFinite(percent)) onProgress(percent)
        }
      }
    })
  }

  try {
    await subprocess
  } catch (err) {
    throw new Error(firstErrorLine(err))
  }

  // 파일 이름은 우리가 정한 것이고, 확장자만 yt-dlp가 알려준 것을 쓴다.
  const candidates = [reportedExt, format].filter(Boolean)
  for (const ext of candidates) {
    const filePath = path.join(destination, `${base}.${ext}`)
    if (await fsp.stat(filePath).catch(() => null)) return { title, filePath }
  }

  throw new Error('다운로드는 끝났지만 결과 파일을 찾지 못했습니다.')
}

/**
 * 재생목록의 트랙들을 순서대로 받는다.
 * 하나가 실패해도 나머지 다운로드는 계속 진행한다.
 *
 * @param {{playlistUrl: string, format: string, destination: string}} options
 * @param {(channel: string, payload: unknown) => void} emit 진행 상황 알림
 */
const downloadPlaylist = async (options, emit = () => {}) => {
  const playlistUrl = String(options?.playlistUrl ?? '').trim()
  const format = String(options?.format ?? '').trim().toLowerCase()
  const destination = String(options?.destination ?? '').trim()

  if (!playlistUrl) throw new Error('URL을 입력해주세요.')
  if (!/^[a-z0-9]{2,5}$/.test(format)) throw new Error('올바른 포맷이 아닙니다.')
  if (!destination) throw new Error('다운로드 경로를 선택해주세요.')

  const stat = await fsp.stat(destination).catch(() => null)
  if (!stat?.isDirectory()) throw new Error('다운로드 경로를 찾을 수 없습니다.')

  const log = (message) => emit('download:log', { level: 'info', message })
  const logDone = (message) => emit('download:log', { level: 'success', message })
  const logError = (message) => emit('download:log', { level: 'error', message })

  log('목록을 불러오는 중입니다.')
  const tracks = await resolveTracks(playlistUrl)
  if (tracks.length === 0) {
    throw new Error('다운로드할 수 있는 항목을 찾지 못했습니다.')
  }
  log(`${tracks.length}개의 항목을 찾았습니다.`)

  // 사운드클라우드처럼 영상이 없는 곳에서 mp4를 고르면 소리만 담긴 파일이 나온다.
  if (!AUDIO_ONLY_FORMATS.has(format) && isAudioOnlySource(playlistUrl)) {
    log(`${format}를 선택하셨지만 사운드클라우드는 소리만 제공합니다. 화면 없는 파일이 만들어집니다.`)
  }

  let succeeded = 0
  const failures = []

  for (const [index, track] of tracks.entries()) {
    const position = `(${index + 1}/${tracks.length})`
    let lastPercent = -1

    // 제목을 먼저 확인해야 진행 로그에 URL 대신 제목을 보여줄 수 있다.
    const title = track.title || (await fetchTitle(track.url))
    log(`${position} ${title || track.url}`)

    try {
      const { filePath } = await downloadTrack({ ...track, title }, destination, format, (percent) => {
        const rounded = Math.floor(percent)
        if (rounded === lastPercent) return // 진행률이 바뀔 때만 알린다.
        lastPercent = rounded
        emit('download:progress', { index, total: tracks.length, percent: rounded })
      })
      succeeded++
      logDone(`${position} 완료: ${path.basename(filePath)}`)
    } catch (err) {
      failures.push({ url: track.url, title, message: err.message })
      logError(`${position} 실패 (${title || track.url}): ${err.message}`)
    }
  }

  const summary = { total: tracks.length, succeeded, failed: failures.length, failures }
  const finish = failures.length > 0 ? logError : logDone
  finish(`다운로드가 끝났습니다. 성공 ${succeeded}개, 실패 ${failures.length}개.`)
  return summary
}

module.exports = {
  downloadPlaylist,
  downloadTrack,
  resolveTracks,
  sanitizeFileName,
  isAudioOnlySource,
  ffmpegPath,
  ytdlpPath
}
