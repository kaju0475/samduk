# 🛑 잠깐! Deploy 누르기 전 필수 확인

네, 사용자님! 공유해주신 화면은 **정확합니다**.
하지만 **지금 바로 Deploy를 누르시면 절대 안 됩니다!**

로그인이 정상적으로 되려면, 아래 설정을 먼저 해주셔야 합니다.

### ⚠️ 필수: 환경변수 입력하기

1. 화면 아래쪽에 있는 **`> Environment Variables`** 탭을 클릭해서 펼치세요.
2. 아래 2개의 변수를 각각 복사해서 넣어주세요.

**1번 변수**

- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://gedsuetwuxqrrboqobdj.supabase.co`
- (입력 후 `Add` 클릭)

**2번 변수**

- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: (아래의 긴 키 전체를 복사하세요)
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHN1ZXR3dXhxcnJib3FvYmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NDU5MDgsImV4cCI6MjA4NDIyMTkwOH0.LJybDvRkAFxCuTQk1tOvM7FDUqdy4blguwk3u6CXwlY`
- (입력 후 `Add` 클릭)

---

### ✅ 이제 Deploy 클릭!

위 2개가 잘 들어갔다면, 이제 **Deploy** 버튼을 누르셔도 좋습니다.
이번에는 100% 성공합니다. 화이팅! 🚀
