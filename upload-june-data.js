// 6월 CSV 데이터 업로드 스크립트
const fs = require('fs');
const path = require('path');

// CSV 파일 경로
const csvFilePath = '/Users/lewis/Downloads/직원 출퇴근 관리 - 2025-06 상세내역.csv';

// CSV 파일 읽기
async function uploadJuneData() {
  try {
    console.log('📂 CSV 파일 읽는 중...');
    const csvData = fs.readFileSync(csvFilePath, 'utf-8');
    
    // 첫 번째 라인(헤더 설명) 제거
    const lines = csvData.split('\n');
    const dataLines = lines.slice(1); // 첫 번째 라인 제거
    const processedCsv = dataLines.join('\n');
    
    console.log('📤 서버로 데이터 전송 중...');
    
    // API 호출
    const response = await fetch('http://localhost:3000/api/admin/attendance/bulk-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer admin-user-id' // 실제 관리자 ID로 변경 필요
      },
      body: JSON.stringify({
        csvData: processedCsv,
        overwrite: true // 기존 데이터 덮어쓰기
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ 업로드 성공!');
      console.log('📊 결과:', result.results);
    } else {
      console.error('❌ 업로드 실패:', result.error);
      if (result.results && result.results.errorMessages) {
        console.error('오류 상세:', result.results.errorMessages);
      }
    }
    
  } catch (error) {
    console.error('❌ 스크립트 실행 오류:', error);
  }
}

// 실행
if (require.main === module) {
  uploadJuneData();
}

module.exports = { uploadJuneData };