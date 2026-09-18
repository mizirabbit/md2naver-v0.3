# MD2Naver Paste UI V0.3

GPT / Gemini가 생성한 Markdown을 네이버 블로그 SmartEditor ONE에 붙여넣기 쉬운 Rich Text로 변환하는 **외부 라이브러리 없는 정적 웹앱**입니다.

## 주요 기능

- GPT/Gemini 복사 후 입력창에 `Ctrl+V`
- `클립보드에서 붙여넣기` 버튼
- Markdown / 일반 텍스트 자동 판별
- 일반 텍스트 문단 미리보기
- Markdown 직접 입력 / `.md` 파일 열기 / Drag & Drop
- 실시간 Naver 스타일 Preview
- 기술 블로그 / 깔끔한 문서 / 기본 / 리뷰 프리셋
- H1~H6, Bold, Italic, Strike, 목록, 인용, 링크, 표, HR
- 코드 블록 언어 표시 + 기본 Syntax Highlighting
- 기본 Mermaid `graph/flowchart` 렌더링(LR/RL/TD/TB/BT)
- Mermaid → PNG Clipboard 복사 Queue
- AI Markdown Callout 보정 (`NOTE`, `TIP`, `WARNING`, `ERROR`)
- 자동 목차 / H2 자동 번호
- 이미지 경로 분석 + 이미지 폴더 매칭 + 이미지 Queue
- JPG/WebP 등 이미지를 PNG로 변환해 Clipboard 복사
- Naver Compatibility 검사
- Rich HTML + Plain Text Clipboard 복사
- 원본 / 결과 비교
- 인터넷 연결 없이 실행 가능

## 실행

### 가장 간단한 실행

Windows에서는 `run.bat`을 더블클릭합니다. Linux/macOS에서는 `./run.sh`를 실행합니다.

직접 실행하려면:

```bash
cd md2naver
python3 -m http.server 8080
```

브라우저:

```text
http://localhost:8766
```

`file://`로 직접 열면 ES Module/Clipboard 브라우저 정책 때문에 제한될 수 있으므로 localhost 실행을 권장합니다.

기존 버전의 서버와 화면이 섞이지 않도록 V0.3은 `8766` 포트를 사용합니다. 화면 상단의 `Paste UI v0.3` 표시로 새 버전을 확인할 수 있습니다.

호환성 검사와 이미지 Queue는 기본적으로 숨깁니다. 호환성 경고, 이미지 또는 Mermaid가 발견되면 필요한 영역만 자동으로 표시하며, `상세 검사` 버튼으로 두 영역을 직접 열고 닫을 수 있습니다.

## 사용법

1. GPT/Gemini에서 내용을 복사한 뒤 입력창에 `Ctrl+V` 하거나 `클립보드에서 붙여넣기`를 누릅니다.
2. 필요하면 보조 기능인 `Markdown 파일 열기` 또는 `.md` Drag & Drop을 사용합니다.
3. 스타일 프리셋을 선택합니다.
4. 이미지가 있으면 `이미지 폴더 선택`을 사용합니다.
5. `Naver Compatibility` 경고를 확인합니다.
6. `NAVER용 복사` → 네이버 SmartEditor ONE에서 `Ctrl+V`.
7. `IMAGE 01`, `DIAGRAM 01` 마커 위치에 이미지 Queue의 복사 버튼으로 이미지를 순서대로 붙여넣습니다.

## Mermaid V0.1 지원 범위

```mermaid
graph LR
A[Markdown] --> B[Preview]
B --> C[Naver]
```

지원: `graph/flowchart LR`, `RL`, `TD`, `TB`, `BT`, 사각/괄호/중괄호 노드와 기본 화살표.
복잡한 Mermaid(subgraph, sequenceDiagram, classDiagram 등)는 원문을 유지하면서 호환성 경고를 표시합니다.

## 구조

```text
md2naver/
├── index.html
├── css/
│   └── app.css
├── js/
│   ├── app.js
│   ├── markdown.js
│   ├── naver-renderer.js
│   ├── validator.js
│   ├── image-manager.js
│   └── clipboard.js
├── samples/
│   └── sample.md
└── README.md
```
