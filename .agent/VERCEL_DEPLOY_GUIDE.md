# 🚀 Vercel 프로젝트 재배포 가이드 (최종)

사용자님, 현재 Vercel의 배포 상태가 꼬여 있어 **프로젝트를 삭제하고 다시 연결하는 것이 가장 빠르고 확실한 방법**입니다.
아래 단계를 순서대로 진행해 주세요.

---

### 1단계: 기존 프로젝트 삭제

1. Vercel 대시보드에서 `samduk` 프로젝트를 클릭합니다.
2. 상단 메뉴의 **Settings**를 클릭합니다.
3. 스크롤을 맨 아래로 내려 **Delete Project** (빨간색 버튼)를 클릭합니다.
4. 프로젝트 이름을 입력하여 삭제를 확정합니다.

### 2단계: 프로젝트 다시 가져오기 (Import)

1. Vercel 메인 화면에서 **Add New...** 버튼을 클릭하고 **Project**를 선택합니다.
2. `kaju0475/samduk` 저장소 옆의 **Import** 버튼을 클릭합니다.

### 3단계: 환경변수 설정 (⚠️ 매우 중요)

**Import** 화면에서 **Environment Variables** 탭을 클릭하고, 아래 두 가지 변수를 반드시 추가해야 합니다.
(이 변수들이 없으면 로그인이 작동하지 않습니다.)

| 변수 이름 (Name)                | 값 (Value)                                                          |
| :------------------------------ | :------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://gedsuetwuxqrrboqobdj.supabase.co`                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **(아래 제공된 `eyJ...`로 시작하는 긴 키를 복사해서 붙여넣으세요)** |

**[복사할 Anon Key 값]**
(사용자님 스크린샷에 있던 그 키입니다.)
`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHN1ZXR3dXhxcnJib3FvYmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NDU5MDgsImV4cCI6MjA4NDIyMTkwOH0.LJybDvRkAFxCuTQk1tOvM7FDUqdy4blguwk3u6CXwlY`

### 4단계: 배포 (Deploy)

1. 모든 설정이 완료되었으면 하단의 **Deploy** 버튼을 클릭합니다.
2. 배포가 완료될 때까지 잠시 기다립니다 (약 1~2분 소요).
3. 배포가 완료되면 `Visit` 버튼을 눌러 사이트에 접속하고 로그인을 시도합니다.

---

**✅ 완료되면 말씀해 주세요!**
이제 모든 기능이 정상적으로 작동할 것입니다.
