# Youtube Downloader

본 프로그램이 법적으로 문제가 있으면 알려주세요.
기타 문의사항도 limjs@izunya.dev으로 메일 바랍니다.

이 프로그램은 Node.js와 Electron을 이용해 **유튜브와 사운드클라우드**의 영상/음원을 mp3나 mp4로 다운로드 받는 프로그램입니다. 사용을 위해선 먼저 [다운로드(2.0.0 버전)](https://github.com/izunya/youtube-downloader/releases/download/v2.0.0/youtube-downloader-2.0.0-win-x64.zip)를 받아주세요. 윈도우 32비트 버전입니다.(64비트에서도 사용가능)

다운로드가 완료되었으면 압축을 해제해주세요. 압축을 해제하고 폴더로 들어가면 'youtube-downloader.exe'라는 파일이 있습니다. 이 파일을 실행하시면 됩니다.

## 사용방법

**1.** 실행하면 다음과 같은 화면이 보일겁니다.

<img width="656" height="746" alt="1" src="https://github.com/user-attachments/assets/c0f66818-d718-44f9-a759-2b81aa246de2" />

여기에는 다음과 같은 입력 공간이 있습니다.
- Play List URL
- Format
- Select Download Path

URL 칸에는 다음을 붙여넣을 수 있습니다.

| 사이트 | 넣을 수 있는 주소 |
| --- | --- |
| 유튜브 | 영상 하나, 또는 재생목록에서 영상을 선택한 뒤의 주소(`&list=...`가 붙은 주소) |
| 사운드클라우드 | 트랙 하나, 세트(`/sets/...`), 또는 사용자의 트랙 목록 |

재생목록 주소를 넣으면 목록 안의 항목을 순서대로 전부 받습니다.

![재생목록 URL](https://github.com/lleellee0/images/blob/master/20190307_003932.png?raw=true)

**2.** Format에서 mp3나 mp4중에 하나를 선택합니다. m4a, wav, flac, ogg도 선택할 수 있습니다.

<img width="95" height="259" alt="2" src="https://github.com/user-attachments/assets/af80f112-6fa4-4739-bbb2-80bc5c592a39" />

사운드클라우드는 소리만 제공하므로 mp4를 고르면 화면 없는 파일이 만들어집니다.
Select Download Path를 클릭하면 폴더 선택 창이 열립니다. 폴더를 하나 만드신 후 선택해주시기 바랍니다.

**3.** 여기까지 입력 후 Start Download를 선택하시면 다운로드가 시작됩니다.

<img width="659" height="747" alt="3" src="https://github.com/user-attachments/assets/0719064f-57dc-41c1-842e-a2b92c5c0f8c" />

다음과 같이 지정한 경로에 파일이 생성되기 시작합니다.

![다운로드 중인 파일들](https://github.com/lleellee0/images/blob/master/20190307_004024.png?raw=true)

기다리시면 다운로드가 완료됩니다.

![다운로드 중인 파일들](https://github.com/lleellee0/images/blob/master/20190307_004336.png?raw=true)


## 사용법 영상
[![사용법 유튜브 영상](https://github.com/lleellee0/images/blob/master/20190307_003945.png?raw=true)](https://www.youtube.com/watch?v=4CaPpuDB5S0&feature=youtu.be)


## 소스코드로 실행하기

Node.js 20.18.1 이상이 필요합니다.

```
npm install
npm start
```

`npm install` 시 yt-dlp와 ffmpeg 바이너리가 함께 내려받아지므로 따로 설치할 필요는 없습니다.

Electron 없이 다운로드 기능만 확인하려면:

```
node test.js "<재생목록 또는 영상 URL>" mp3 "<저장할 폴더>"
```

## 구조

- `main.js` - Electron 메인 프로세스. 창 생성과 IPC 핸들러
- `preload.js` - 렌더러에 노출하는 API(`window.api`)
- `src/downloader.js` - 재생목록 조회와 다운로드 로직
- `js/renderer.js`, `js/log.js` - 화면 처리. Node API를 사용하지 않는다

## 참고

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - 실제 다운로드를 담당
- [youtube-dl-exec](https://www.npmjs.com/package/youtube-dl-exec) - yt-dlp를 Node.js에서 실행
- [ffmpeg](https://www.ffmpeg.org/) - FFMPEG 사용하여 인코딩
- [ffmpeg-static](https://www.npmjs.com/package/ffmpeg-static) - NPM ffmpeg-static
- [Electron 보안 권고사항](https://www.electronjs.org/docs/latest/tutorial/security) - contextIsolation, CSP

## License

[CC0 1.0 (Public Domain)](LICENSE.md)
