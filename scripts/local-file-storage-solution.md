# 로컬 파일 저장소 솔루션

## 해결 방안
JSON 파일을 사용하여 로컬에서 영구 저장

### 1. 구현 예시

```typescript
// lib/persistentLocalData.ts
import fs from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'local-leave-data.json')

export function saveLocalLeaveData(data: any) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

export function loadLocalLeaveData() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  }
  return DEFAULT_DATA
}
```

### 2. 장점
- ✅ 서버 재시작 후에도 데이터 유지
- ✅ Supabase 독립적
- ✅ 로컬 테스트 환경에 최적화

### 3. 단점
- ❌ 여전히 브라우저 간 실시간 연동 불가
- ❌ 파일 동시성 문제 가능성
- ❌ 프로덕션 환경과 다른 동작