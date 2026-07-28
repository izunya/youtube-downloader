'use strict'

// file:// 에서는 ES 모듈을 쓸 수 없으므로 전역 객체로 노출한다.
window.log = (() => {
  const logArea = document.getElementById('logArea')
  const LEVELS = new Set(['info', 'success', 'error'])

  /** 한 줄을 추가한다. level에 따라 점 색이 달라진다. */
  const add = (level, message) => {
    const line = document.createElement('div')
    line.className = `log-line log-line-${LEVELS.has(level) ? level : 'info'}`

    const dot = document.createElement('span')
    dot.className = 'log-dot'

    const text = document.createElement('span')
    text.className = 'log-text'
    text.textContent = message // 제목에 있을 수 있는 마크업을 그대로 문자로 넣는다.

    line.append(dot, text)
    logArea.append(line)
    logArea.scrollTop = logArea.scrollHeight // 항상 마지막 줄이 보이도록
  }

  return {
    add,
    addLog: (message) => add('info', message),
    addErrorLog: (message) => add('error', message),
    clearLog: () => logArea.replaceChildren()
  }
})()
