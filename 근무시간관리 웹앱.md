Code.gs

/**
 * @file Code.gs
 * @description 메인 서버 로직, UI 메뉴, 웹 앱 엔드포인트 관리
 */

const CONFIG = {
  MASTER_SHEET_ID: '1hS0UE8BhzpDi2yLv2CCOU1krncQMOWEAnxTQk0hZrRE',
  SHEETS: {
    SETTINGS: "설정",
    WAGE_TABLE: "임금테이블",
    INPUT_VALUES: (year) => `${year}-입력값`,
    UNIFIED_LOGS: (month) => `${month}-기록`,
    DETAIL: (month) => `${month} 상세내역`,
    RESULT: (month) => `${month} 결과`
  },
  TIMEZONE: "Asia/Seoul"
};

/**
 * 임금테이블에서 모든 직원 정보(입사일, 퇴사일 포함)를 로드하는 함수
 */
function _loadEmployeeData() {
  try {
    const masterSS = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const sheet = masterSS.getSheetByName(CONFIG.SHEETS.WAGE_TABLE);
    if (!sheet) return new Map();

    const data = sheet.getDataRange().getValues();
    if (data.length < 3) return new Map();

    const headers = data[0].map(h => h.toString().trim()); // 헤더를 1행에서 읽음
    const nameIdx = headers.indexOf("성명");
    const hireDateIdx = headers.indexOf("입사일");
    const termDateIdx = headers.indexOf("퇴사일");

    if (nameIdx === -1) {
      Logger.log("'임금테이블'의 1행에 '성명' 열이 없습니다.");
      return new Map();
    }
    
    const employeeData = new Map();
    for (let i = 2; i < data.length; i++) { // 데이터는 3행부터 읽음
      const name = data[i][nameIdx].toString().replace(/\s/g, '');
      if (!name) continue;

      const hireDateValue = hireDateIdx > -1 ? data[i][hireDateIdx] : null;
      const termDateValue = termDateIdx > -1 ? data[i][termDateIdx] : null;
      
      let hireDate = null;
      if (hireDateValue) {
        if (hireDateValue instanceof Date) hireDate = new Date(hireDateValue);
        else if (typeof hireDateValue === 'string') hireDate = new Date(hireDateValue.replace(/\./g, '-').replace(/\s/g, '').replace(/-$/, ''));
        if (hireDate && isNaN(hireDate.getTime())) hireDate = null;
      }

      let termDate = null;
      if (termDateValue) {
        if (termDateValue instanceof Date) termDate = new Date(termDateValue);
        else if (typeof termDateValue === 'string') termDate = new Date(termDateValue.replace(/\./g, '-').replace(/\s/g, '').replace(/-$/, ''));
        if (termDate && isNaN(termDate.getTime())) termDate = null;
      }

      if (hireDate) hireDate.setHours(0, 0, 0, 0);
      if (termDate) termDate.setHours(0, 0, 0, 0);
      
      employeeData.set(name, { hireDate: hireDate, termDate: termDate });
    }
    return employeeData;
  } catch (e) {
    Logger.log(`_loadEmployeeData 오류: ${e}`);
    return new Map();
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('근무시간 계산기')
    .addItem('월별 보고서 생성 (상세+결과)', 'generateMonthlyReport')
    .addSeparator()
    .addItem('결과 시트만 재계산', 'recalculateResultSheet')
    .addSeparator()
    .addItem('입사일 정보 로드 테스트', 'test_loadEmployeeData')
    .addItem('직원 이름 매칭 테스트', 'test_nameMatching')
    .addToUi();
}

function _getNamesFromLogSheet(month) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = CONFIG.SHEETS.UNIFIED_LOGS(month);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return new Set();

    const data = sheet.getRange("E2:E").getValues();
    const names = new Set();
    data.forEach(row => {
        if (row[0]) {
            names.add(row[0].toString().replace(/\s/g, ''));
        }
    });
    return names;
}

function test_nameMatching() {
    const ui = SpreadsheetApp.getUi();
    const monthResult = ui.prompt('테스트할 월 입력', '"YYYY-MM" 형식으로 입력해주세요.', ui.ButtonSet.OK_CANCEL);
    const month = monthResult.getResponseText().trim();
    if (monthResult.getSelectedButton() !== ui.Button.OK || !/^\d{4}-\d{2}$/.test(month)) {
        ui.alert("취소되었거나 형식이 잘못되었습니다.");
        return;
    }

    try {
        const wageTableNames = new Set(_loadEmployeeData().keys());
        const logSheetNames = _getNamesFromLogSheet(month);

        if (wageTableNames.size === 0 && logSheetNames.size === 0) {
            ui.alert("양쪽 시트에서 모두 직원 정보를 찾을 수 없습니다.");
            return;
        }

        const matched = new Set([...wageTableNames].filter(name => logSheetNames.has(name)));
        const onlyInLog = new Set([...logSheetNames].filter(name => !wageTableNames.has(name)));
        const onlyInWage = new Set([...wageTableNames].filter(name => !logSheetNames.has(name)));

        let message = `--- [${month}] 이름 매칭 테스트 결과 ---\n\n`;
        message += `[매칭 성공 (${matched.size}명)]\n${[...matched].join(', ')}\n\n`;
        message += `[기록 시트에만 있음 (${onlyInLog.size}명)] - (입사일/퇴사일 적용 불가)\n${[...onlyInLog].join(', ')}\n\n`;
        message += `[임금테이블에만 있음 (${onlyInWage.size}명)] - (해당 월 기록 없음)\n${[...onlyInWage].join(', ')}`;
        
        ui.alert(message);

    } catch (e) {
        ui.alert(`테스트 중 오류 발생: ${e.message}`);
    }
}


function test_loadEmployeeData() {
  const ui = SpreadsheetApp.getUi();
  try {
    const employeeDataMap = _loadEmployeeData();
    if (employeeDataMap.size === 0) {
      ui.alert("불러온 직원 정보가 없습니다. '임금테이블' 시트의 1행에 '성명'과 '입사일' 헤더가 있는지, 3행부터 데이터가 있는지 확인해주세요.");
      return;
    }

    let message = "✅ 직원 정보 로드 성공:\n\n";
    employeeDataMap.forEach((value, key) => {
      const hire = value.hireDate ? Utilities.formatDate(value.hireDate, CONFIG.TIMEZONE, 'yyyy-MM-dd') : "없음";
      const term = value.termDate ? Utilities.formatDate(value.termDate, CONFIG.TIMEZONE, 'yyyy-MM-dd') : "없음";
      message += `${key}: 입사 ${hire}, 퇴사 ${term}\n`;
    });

    Logger.log(message);
    ui.alert(message);

  } catch (e) {
    Logger.log(`테스트 오류: ${e.toString()}`);
    ui.alert(`❌ 테스트 중 오류가 발생했습니다: ${e.message}`);
  }
}


function generateMonthlyReport() {
  const ui = SpreadsheetApp.getUi();
  const availableMonths = getAvailableRawMonths();
  if (availableMonths.length === 0) {
    ui.alert("계산 가능한 월(YYYY-MM-기록 형식의 시트)이 없습니다.");
    return;
  }
  const result = ui.prompt('계산할 월 입력', `사용 가능한 월:\n${availableMonths.join(', ')}\n\n아래에 "YYYY-MM" 형식으로 입력해주세요.`, ui.ButtonSet.OK_CANCEL);
  const button = result.getSelectedButton();
  const month = result.getResponseText().trim();

  if (button == ui.Button.OK && /^\d{4}-\d{2}$/.test(month)) {
    ui.alert(`[${month}] 월별 보고서 생성을 시작합니다. 완료되면 알림이 표시됩니다. (최대 1~2분 소요)`);
    try {
      const employeeDataMap = _loadEmployeeData();
      
      const detailResponse = generateDetailSheet(month, employeeDataMap);
      if (!detailResponse.success) throw new Error(detailResponse.error);
      
      const resultResponse = _calculateAndWriteSummary(month, employeeDataMap);
      if (!resultResponse.success) throw new Error(resultResponse.error);

      ui.alert(`✅ [${month}] 월별 보고서(상세내역, 결과)가 성공적으로 생성/업데이트되었습니다.`);
    } catch (e) {
      ui.alert(`❌ 오류 발생: ${e.message}`);
      Logger.log(e);
    }
  } else if (button != ui.Button.CANCEL) {
    ui.alert('잘못된 형식입니다. "YYYY-MM" 형식으로 다시 입력해주세요.');
  }
}

function recalculateResultSheet() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const sheetName = activeSheet.getName();
  const monthMatch = sheetName.match(/^(\d{4}-\d{2})/);

  if (!monthMatch) {
    ui.alert("YYYY-MM 형식의 '상세내역' 또는 '결과' 시트에서 실행해주세요.");
    return;
  }
  const month = monthMatch[1];
  
  try {
    const employeeDataMap = _loadEmployeeData();
    const response = _calculateAndWriteSummary(month, employeeDataMap);
    if (response.success) {
      ui.alert(`'${CONFIG.SHEETS.RESULT(month)}' 시트가 성공적으로 업데이트되었습니다.`);
    } else {
      throw new Error(response.error);
    }
  } catch (e) {
    ui.alert(`❌ 오류 발생: ${e.message}`);
    Logger.log(e);
  }
}

function _calculateAndWriteSummary(month, employeeDataMap) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const detailSheetName = CONFIG.SHEETS.DETAIL(month);
    const detailSheet = ss.getSheetByName(detailSheetName);

    if (!detailSheet || detailSheet.getLastRow() < 3) {
      throw new Error(`'${detailSheetName}' 시트를 찾을 수 없거나 데이터가 없습니다.`);
    }
    
    const [year, monthNum] = month.split('-').map(Number);
    const { holidays } = loadInputsForMonth_(month);
    const holidaysSet = new Set(holidays);

    const info = detailSheet.getRange("A1").getValue();
    let flexPeriodMessage = "";
    const flexMatch = info.match(/\(탄력근로제.*\)/);
    if (flexMatch) flexPeriodMessage = flexMatch[0];
    
    const detailData = detailSheet.getRange(3, 1, detailSheet.getLastRow() - 2, 13).getValues();
    const summary = {};

    detailData.forEach(row => {
      const name = row[0].toString().replace(/\s/g, '');
      if (!name) return;

      if (!summary[name]) {
        summary[name] = { base: 0, extension: 0, night: 0, substitute: 0, compensatory: 0, workDays: 0, totalActualHours: 0, dinnerHours: 0 };
      }
      
      const status = row[3] || "";
      if (status.includes('+저녁')) {
        summary[name].dinnerHours += 1;
      }

      const base = parseFloat(row[7] || 0);
      const extension = parseFloat(row[8] || 0);
      const night = parseFloat(row[9] || 0);
      const substitute = parseFloat(row[10] || 0);
      const compensatory = parseFloat(row[11] || 0);
      const checkInTime = row[4];

      summary[name].base += base;
      summary[name].extension += extension;
      summary[name].night += night;
      summary[name].substitute += substitute;
      summary[name].compensatory += compensatory;
      
      if(checkInTime && !status.includes("누락")) {
        summary[name].workDays += 1;
        summary[name].totalActualHours += (base + extension);
      }
    });

    for (const name in summary) {
      const employeeInfo = employeeDataMap.get(name);
      const hireDate = employeeInfo ? employeeInfo.hireDate : null;
      const termDate = employeeInfo ? employeeInfo.termDate : null;
      
      const { standardHours } = calculateStandardHours_(year, monthNum, holidaysSet, hireDate, termDate);

      summary[name].grandTotalHours = summary[name].base + summary[name].extension + summary[name].substitute + summary[name].compensatory;
      summary[name].averageWorkHours = summary[name].workDays > 0 ? summary[name].totalActualHours / summary[name].workDays : 0;
      summary[name].differenceFromStandard = summary[name].grandTotalHours - standardHours;
    }

    const standardHoursMatch = info.match(/기준 근로시간: (\d+(\.\d+)?)/);
    const actualStandardHoursMatch = info.match(/실근무일 기준: (\d+(\.\d+)?)/);
    const fullMonthStandardHours = standardHoursMatch ? parseFloat(standardHoursMatch[1]) : 0;
    const fullMonthActualStandardHours = actualStandardHoursMatch ? parseFloat(actualStandardHoursMatch[1]) : 0;

    writeSummaryToSheet_(month, summary, fullMonthStandardHours, fullMonthActualStandardHours, flexPeriodMessage);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function writeSummaryToSheet_(baseSheetName, results, standardHours, actualStandardHours, flexPeriodMessage) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resultSheetName = CONFIG.SHEETS.RESULT(baseSheetName);
  let resultSheet = ss.getSheetByName(resultSheetName);
  if (resultSheet) resultSheet.clear(); else resultSheet = ss.insertSheet(resultSheetName);
  
  let a1Text = `${baseSheetName} 기준 근로시간: ${standardHours}시간 (실근무일 기준: ${actualStandardHours}시간)`;
  if (flexPeriodMessage) a1Text += ` ${flexPeriodMessage}`;
  resultSheet.getRange("A1").setValue(a1Text).setFontWeight('bold');
  resultSheet.getRange("A1:K1").merge();
  
  const now = new Date();
  const timestamp = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  const updateCell = resultSheet.getRange("L1");
  updateCell.setValue(`최종 업데이트: ${timestamp}`).setFontWeight('bold').setFontColor('#0066cc').setBackground('#e6f3ff').setBorder(true, true, true, true, false, false, '#0066cc', SpreadsheetApp.BorderStyle.SOLID);
  
  const headers = ['직원명', '기본(h)', '연장(h)', '야간(h)', '발생대체(h)', '발생보상(h)', '저녁휴게(h)', '일평균 근무(h)', '총 실근무시간', '총 인정시간', '기준시간 차이(h)'];
  const outputData = [headers];
  const sortedEmployees = Object.keys(results).sort();
  for (const employee of sortedEmployees) {
    const data = results[employee];
    outputData.push([
      employee, roundToHalf_(data.base), roundToHalf_(data.extension), roundToHalf_(data.night),
      roundToHalf_(data.substitute || 0), roundToHalf_(data.compensatory || 0),
      data.dinnerHours || 0,
      roundToOneDecimal_(data.averageWorkHours || 0),
      roundToHalf_(data.totalActualHours || 0),
      roundToHalf_(data.grandTotalHours || 0),
      roundToOneDecimal_(data.differenceFromStandard || 0)
    ]);
  }
  if (outputData.length > 1) {
    resultSheet.getRange(2, 1, outputData.length, headers.length).setValues(outputData).setFontFamily("system-ui");
    resultSheet.getRange(2, 1, 1, headers.length).setFontWeight('bold').setHorizontalAlignment('center');
    resultSheet.getRange(3, 2, outputData.length - 1, headers.length - 1).setNumberFormat("0.0");
    resultSheet.getRange(3, 7, outputData.length - 2, 1).setNumberFormat("0");
    resultSheet.setFrozenRows(2);
    resultSheet.autoResizeColumns(1, headers.length);
    const minWidth = 100;
    for (let i = 1; i <= headers.length; i++) {
      if(i==1) resultSheet.setColumnWidth(i, 80);
      else if (resultSheet.getColumnWidth(i) < minWidth) resultSheet.setColumnWidth(i, minWidth);
    }
  }
  resultSheet.setColumnWidth(12, 200);
}

function roundToHalf_(value) { return Math.round(value * 2) / 2; }
function roundToOneDecimal_(value) { return Math.round(value * 10) / 10; }

function doGet(e) {
  const page = e.parameter.page;
  if (page === 'worktime') {
    return HtmlService.createHtmlOutputFromFile('WorkTimeViewerUI').setTitle("개인 근무시간 조회").addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } else {
    return HtmlService.createHtmlOutputFromFile('Index').setTitle("출퇴근 기록 시스템").addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
}

function recordAttendance(name, status, reason, manualDate, manualTime, latitude, longitude, accuracy, hadDinner) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let timestamp;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^\d{2}:\d{2}$/;

    if (manualDate && dateRegex.test(manualDate) && manualTime && timeRegex.test(manualTime)) {
      const [year, month, day] = manualDate.split('-').map(Number);
      const [hours, minutes] = manualTime.split(':').map(Number);
      timestamp = new Date(year, month - 1, day, hours, minutes);
    } else {
      timestamp = new Date();
    }

    const monthKey = Utilities.formatDate(timestamp, CONFIG.TIMEZONE, "yyyy-MM");
    const unifiedSheetName = CONFIG.SHEETS.UNIFIED_LOGS(monthKey);
    let sheet = spreadsheet.getSheetByName(unifiedSheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(unifiedSheetName, 0);
      const headers = ["발생일자", "발생시각", "단말기ID", "사용자ID", "이름", "사원번호", "직급", "구분", "모드", "인증", "결과", "저녁식사"];
      sheet.appendRow(headers);
      sheet.getRange("A1:L1").setFontWeight("bold").setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }

    const employeeNumber = getEmployeeNumberByName(name);
    const newRow = [
      Utilities.formatDate(timestamp, CONFIG.TIMEZONE, "yyyy. M. d."),
      Utilities.formatDate(timestamp, CONFIG.TIMEZONE, "a h:mm:ss"),
      "웹앱", "", name, employeeNumber, "", reason, status, "WEB", "O",
      (status === '퇴근' && hadDinner) ? 'O' : ''
    ];

    sheet.appendRow(newRow);
    return `✅ 기록 완료: ${name}님, [${unifiedSheetName}] 시트에 ${status} 처리되었습니다.`;
  } catch (error) {
    Logger.log(`recordAttendance 오류: ${error.toString()}`);
    return `❌ 오류 발생: ${error.message}`;
  }
}

function updateDinnerStatus(name, dateString, status) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const monthKey = dateString.substring(0, 7);
    const unifiedSheetName = CONFIG.SHEETS.UNIFIED_LOGS(monthKey);
    const sheet = spreadsheet.getSheetByName(unifiedSheetName);

    if (!sheet) return `❌ 오류: [${unifiedSheetName}] 시트를 찾을 수 없습니다.`;

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const dateIdx = headers.indexOf("발생일자");
    const nameIdx = headers.indexOf("이름");
    const modeIdx = headers.indexOf("모드");
    let dinnerIdx = headers.indexOf("저녁식사");

    if (dinnerIdx === -1) {
      sheet.getRange(1, headers.length + 1).setValue("저녁식사");
      dinnerIdx = headers.length;
    }

    for (let i = data.length - 1; i > 0; i--) {
      const row = data[i];
      const recordDate = Utilities.formatDate(new Date(row[dateIdx]), CONFIG.TIMEZONE, "yyyy-MM-dd");
      if (recordDate === dateString && row[nameIdx].toString().trim() === name && row[modeIdx] === '퇴근') {
        sheet.getRange(i + 1, dinnerIdx + 1).setValue(status);
        
        const employeeDataMap = _loadEmployeeData();
        generateDetailSheet(monthKey, employeeDataMap);
        _calculateAndWriteSummary(monthKey, employeeDataMap);
        
        return `✅ 저녁식사 상태가 모든 시트에 즉시 반영되었습니다.`;
      }
    }
    return `⚠️ ${dateString}의 퇴근 기록을 찾을 수 없습니다.`;
  } catch (e) {
    Logger.log(`updateDinnerStatus 오류: ${e.toString()}`);
    return `❌ 저녁식사 상태 업데이트 중 오류 발생: ${e.message}`;
  }
}

function addMissingRecord(name, dateString, timeString, recordType) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const monthKey = dateString.substring(0, 7);
    const unifiedSheetName = CONFIG.SHEETS.UNIFIED_LOGS(monthKey);
    let sheet = spreadsheet.getSheetByName(unifiedSheetName);
    if (!sheet) return `❌ 오류: [${unifiedSheetName}] 시트를 찾을 수 없습니다.`;

    const [year, month, day] = dateString.split('-').map(Number);
    const [hours, minutes] = timeString.split(':').map(Number);
    const timestamp = new Date(year, month - 1, day, hours, minutes);
    const employeeNumber = getEmployeeNumberByName(name);
    const mode = (recordType === '출근') ? '출근' : '퇴근';
    
    const newRow = ["발생일자", "발생시각", "단말기ID", "사용자ID", "이름", "사원번호", "직급", "구분", "모드", "인증", "결과", "저녁식사"].map(h => {
        switch(h) {
            case "발생일자": return Utilities.formatDate(timestamp, CONFIG.TIMEZONE, "yyyy. M. d.");
            case "발생시각": return Utilities.formatDate(timestamp, CONFIG.TIMEZONE, "a h:mm:ss");
            case "단말기ID": return "웹앱";
            case "이름": return name;
            case "사원번호": return employeeNumber;
            case "구분": return "누락 기록 보충";
            case "모드": return mode;
            case "인증": return "WEB";
            case "결과": return "O";
            default: return "";
        }
    });

    sheet.appendRow(newRow);
    
    const employeeDataMap = _loadEmployeeData();
    generateDetailSheet(monthKey, employeeDataMap);
    _calculateAndWriteSummary(monthKey, employeeDataMap);

    return `✅ 누락된 기록이 모든 시트에 즉시 반영되었습니다.`;
  } catch (error) {
    Logger.log(`addMissingRecord 오류: ${error.toString()}`);
    return `❌ 오류 발생: ${error.message}`;
  }
}

function getEmployeeNumberByName(name) {
  try {
    const masterSpreadsheet = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const employeeSheet = masterSpreadsheet.getSheetByName(CONFIG.SHEETS.WAGE_TABLE);
    if (!employeeSheet) return "";
    const data = employeeSheet.getDataRange().getValues();
    for (let i = 2; i < data.length; i++) {
      if (data[i][1].toString().trim() === name) return data[i][0];
    }
    return "";
  } catch (e) {
    Logger.log(`getEmployeeNumberByName 오류: ${e.toString()}`);
    return "";
  }
}

function getCurrentUserInfo() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    if (!userEmail) return { success: false, error: "로그인 정보를 확인할 수 없습니다." };
    const masterSpreadsheet = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const employeeSheet = masterSpreadsheet.getSheetByName(CONFIG.SHEETS.WAGE_TABLE);
    if (!employeeSheet) return { success: false, error: `'${CONFIG.SHEETS.WAGE_TABLE}' 시트를 찾을 수 없습니다.` };
    const values = employeeSheet.getDataRange().getValues();
    for (let i = 2; i < values.length; i++) {
      const rowEmail = values[i][7];
      const rowName = values[i][1].toString().trim();
      if (rowEmail && rowEmail.toString().toLowerCase() === userEmail.toLowerCase()) {
        return { success: true, email: userEmail, name: rowName };
      }
    }
    return { success: false, error: "등록되지 않은 사용자입니다. 관리자에게 문의하세요." };
  } catch (error) {
    Logger.log("getCurrentUserInfo 오류: " + error.toString());
    return { success: false, error: "사용자 정보 조회 중 오류가 발생했습니다." };
  }
}

function getAvailableWorkTimeMonths() {
  try {
    const currentSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = currentSpreadsheet.getSheets();
    const availableMonths = [];
    const resultSheetRegex = new RegExp(`^(\\d{4}-\\d{2})\\s*${CONFIG.SHEETS.RESULT('').trim()}$`);
    sheets.forEach(sheet => {
      const sheetName = sheet.getName();
      const match = sheetName.match(resultSheetRegex);
      if (match) {
        availableMonths.push({
          key: match[1],
          displayName: `${match[1].split('-')[0]}년 ${match[1].split('-')[1]}월`,
          sheetName: sheetName
        });
      }
    });
    availableMonths.sort((a, b) => b.key.localeCompare(a.key));
    return { success: true, months: availableMonths };
  } catch (error) {
    Logger.log("getAvailableWorkTimeMonths 오류: " + error.toString());
    return { success: false, error: "월 목록 조회 중 오류가 발생했습니다." };
  }
}

function getPersonalWorkTimeData(monthKey, employeeName) {
  try {
    if (!monthKey || !employeeName) return { success: false, error: "월 또는 직원명이 지정되지 않았습니다." };
    const currentSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const resultSheetName = CONFIG.SHEETS.RESULT(monthKey);
    const resultSheet = currentSpreadsheet.getSheetByName(resultSheetName);
    if (!resultSheet) return { success: false, error: `'${resultSheetName}' 시트를 찾을 수 없습니다.` };
    const values = resultSheet.getDataRange().getValues();
    if (values.length < 3) return { success: false, error: "결과 시트에 데이터가 충분하지 않습니다." };
    let a1Text = "정보 없음";
    if (values.length > 0 && values[0] && values[0][0]) a1Text = values[0][0].toString();
    let l1Text = "정보 없음";
    if (values.length > 0 && values[0] && values[0].length > 11 && values[0][11]) l1Text = values[0][11].toString();
    const headerRow = values[1];
    const employeeNameColIndex = 0;
    const dailyAvgColIndex = headerRow.indexOf('일평균 근무(h)');
    const actualTotalColIndex = headerRow.indexOf('총 실근무시간');
    const grandTotalColIndex = headerRow.indexOf('총 인정시간');
    if (dailyAvgColIndex === -1 || actualTotalColIndex === -1 || grandTotalColIndex === -1) {
      return { success: false, error: "결과 시트에서 필요한 컬럼(일평균, 총 실근무, 총 인정)을 찾을 수 없습니다." };
    }
    for (let i = 2; i < values.length; i++) {
      const rowEmployeeName = values[i][employeeNameColIndex];
      if (rowEmployeeName && rowEmployeeName.toString().trim() === employeeName.trim()) {
        const dailyAverage = values[i][dailyAvgColIndex] || 0;
        const actualTotal = values[i][actualTotalColIndex] || 0;
        const grandTotal = values[i][grandTotalColIndex] || 0;
        return {
          success: true,
          data: {
            monthKey, employeeName, dailyAverage: parseFloat(dailyAverage),
            actualTotal: parseFloat(actualTotal), grandTotal: parseFloat(grandTotal), a1Text, l1Text
          }
        };
      }
    }
    return { success: false, error: `${employeeName}님의 ${monthKey}월 데이터를 찾을 수 없습니다.` };
  } catch (error) {
    Logger.log("getPersonalWorkTimeData 오류: " + error.toString());
    return { success: false, error: "요약 근무시간 데이터 조회 중 오류가 발생했습니다: " + error.toString() };
  }
}

function getPersonalWorkTimeDataWithDetails(monthKey, employeeName) {
  try {
    const summaryResult = getPersonalWorkTimeData(monthKey, employeeName);
    if (!summaryResult.success) return summaryResult;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const dinnerStatusMap = new Map();
    const unifiedSheetName = CONFIG.SHEETS.UNIFIED_LOGS(monthKey);
    const unifiedSheet = ss.getSheetByName(unifiedSheetName);
    if (unifiedSheet) {
        const unifiedData = unifiedSheet.getDataRange().getValues();
        const uHeaders = unifiedData[0];
        const uDateIdx = uHeaders.indexOf("발생일자");
        const uNameIdx = uHeaders.indexOf("이름");
        const uModeIdx = uHeaders.indexOf("모드");
        const uDinnerIdx = uHeaders.indexOf("저녁식사");

        if (uNameIdx > -1 && uDateIdx > -1 && uModeIdx > -1 && uDinnerIdx > -1) {
            for(let i = 1; i < unifiedData.length; i++) {
                const row = unifiedData[i];
                if (row[uNameIdx].toString().trim() === employeeName && row[uModeIdx] === '퇴근') {
                    const recordDate = Utilities.formatDate(new Date(row[uDateIdx]), CONFIG.TIMEZONE, "yyyy-MM-dd");
                    dinnerStatusMap.set(recordDate, row[uDinnerIdx]);
                }
            }
        }
    }

    const detailSheetName = CONFIG.SHEETS.DETAIL(monthKey);
    const detailSheet = ss.getSheetByName(detailSheetName);
    const details = [];

    if (!detailSheet) {
      Logger.log(`'${detailSheetName}' 시트를 찾을 수 없습니다.`);
    } else {
      const data = detailSheet.getDataRange().getDisplayValues(); 
      if (data.length > 2) {
        const headers = data[1];
        const nameIdx = headers.indexOf('직원명');
        const dateIdx = headers.indexOf('날짜');
        const dayOfWeekIdx = headers.indexOf('요일');
        const statusIdx = headers.indexOf('근무상태');
        const checkinIdx = headers.indexOf('출근시간');
        const checkoutIdx = headers.indexOf('퇴근시간');
        const baseIdx = headers.indexOf('기본(h)');
        const extensionIdx = headers.indexOf('연장(h)');
        const noteIdx = headers.indexOf('비고');
        const substituteIdx = headers.indexOf('발생대체(h)');
        const compensatoryIdx = headers.indexOf('발생보상(h)');

        for (let i = 2; i < data.length; i++) {
          const row = data[i];
          if (row[nameIdx].toString().trim() === employeeName) {
            if (!row[dateIdx]) continue;
            
            const dateString = row[dateIdx];
            const status = row[statusIdx] || "";
            const checkinTimeStr = row[checkinIdx] || "";
            const checkoutTimeStr = row[checkoutIdx] || "";
            
            const baseHours = parseFloat(row[baseIdx] || 0);
            let netWorkHours = baseHours;
            if (status.includes('정상근무')) {
                netWorkHours += parseFloat(row[extensionIdx] || 0);
            }

            const currentDinnerStatus = dinnerStatusMap.get(dateString) || "";
            
            let isDinnerMissing = false;
            if (checkinTimeStr && checkoutTimeStr && currentDinnerStatus === "") {
                const dinnerHourStart = new Date(`1970-01-01T19:00:00`);
                const checkinMatch = checkinTimeStr.match(/\d{1,2}:\d{2}:\d{2}/);
                const checkoutMatch = checkoutTimeStr.match(/\d{1,2}:\d{2}:\d{2}/);

                if (checkinMatch && checkoutMatch) {
                    const checkin = new Date(`1970-01-01T${checkinMatch[0]}`);
                    let checkout = new Date(`1970-01-01T${checkoutMatch[0]}`);
                    if (checkout < checkin) checkout.setDate(checkout.getDate() + 1);

                    if (netWorkHours >= 8 && checkin <= dinnerHourStart && checkout > dinnerHourStart) {
                        isDinnerMissing = true;
                    }
                }
            }
            
            details.push({
              date: dateString,
              dayOfWeek: row[dayOfWeekIdx],
              status: status,
              checkin: checkinTimeStr,
              checkout: checkoutTimeStr,
              note: noteIdx > -1 ? row[noteIdx] : "",
              isDinnerMissing: isDinnerMissing,
              dinnerStatus: currentDinnerStatus
            });
          }
        }
      }
    }
    return { success: true, data: { summary: summaryResult.data, details: details } };
  } catch (e) {
    Logger.log(`getPersonalWorkTimeDataWithDetails 오류: ${e.toString()}`);
    return { success: false, error: "상세 근무내역 조회 중 오류가 발생했습니다." };
  }
}

Index.Html

<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif; padding: 20px; text-align: center; background-color: #f4f7f6; }
      #main { max-width: 400px; margin: 20px auto; background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
      h2 { color: #333; }
      select, button, textarea, input[type="text"], input[type="time"], input[type="date"] { width: 100%; padding: 15px; margin: 10px 0; font-size: 16px; border-radius: 8px; box-sizing: border-box; border: 1px solid #ccc; font-family: inherit; }
      textarea { resize: vertical; min-height: 80px; }
      button { cursor: pointer; color: white; border: none; font-weight: bold; }
      button:disabled { background-color: #cccccc; cursor: not-allowed; }
      #btn-checkin { background-color: #28a745; }
      #btn-checkout { background-color: #dc3545; }
      #status { margin-top: 20px; font-weight: bold; min-height: 40px; color: #555; line-height: 1.5; }
      #name { background-color: #f0f0f0; font-weight: bold; text-align: center; }
      label { display: block; margin-top: 15px; font-weight: bold; color: #555; text-align: left; }
    </style>
  </head>
  <body>
    <div id="main">
      <h2>📍 출퇴근 기록하기</h2>
      
      <input type="text" id="name" placeholder="사용자 정보 확인 중..." readonly>

      <label for="manual-date">기록 날짜 (수정 가능)</label>
      <input type="date" id="manual-date">

      <label for="manual-time">기록 시간 (수정 가능)</label>
      <input type="time" id="manual-time">

      <label for="reason">사유</label>
      <textarea id="reason" placeholder="출근 시 정확한 프로젝트명, 업무 내용 등을 입력해주세요."></textarea>
      
      <button id="btn-checkin" onclick="checkInOrOut('출근')" disabled>출근하기</button>
      <button id="btn-checkout" onclick="checkInOrOut('퇴근')" disabled>퇴근하기</button>
      
      <div id="status">사용자 정보를 확인 중입니다...</div>
    </div>
    
    <script>
      window.onload = function() {
        google.script.run
          .withSuccessHandler(populateUserInfo)
          .withFailureHandler(handleError)
          .getCurrentUserInfo();
      };
      
      function populateUserInfo(userInfo) {
        const nameInput = document.getElementById('name');
        const checkinBtn = document.getElementById('btn-checkin');
        const checkoutBtn = document.getElementById('btn-checkout');
        const statusDiv = document.getElementById('status');
        const dateInput = document.getElementById('manual-date');
        const timeInput = document.getElementById('manual-time');

        const now = new Date();
        
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;

        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeInput.value = `${hours}:${minutes}`;

        if (userInfo.success) {
          const name = userInfo.name;
          nameInput.value = name;
          checkinBtn.disabled = false;
          checkoutBtn.disabled = false;
          statusDiv.textContent = name + '님, 환영합니다. 날짜와 시간을 확인하고 버튼을 눌러주세요.';
        } else {
          nameInput.value = '등록되지 않은 사용자';
          statusDiv.innerHTML = "❌ 접근 권한 없음<br>" + (userInfo.error || "직원 명부에 등록된 구글 계정으로 로그인해주세요.");
          dateInput.disabled = true;
          timeInput.disabled = true;
        }
      }

      function checkInOrOut(status) {
        const name = document.getElementById('name').value;
        const reason = document.getElementById('reason').value.trim();
        const manualDate = document.getElementById('manual-date').value;
        const manualTime = document.getElementById('manual-time').value;
        const statusDiv = document.getElementById('status');
        
        if (!name || name === '등록되지 않은 사용자') {
          statusDiv.innerText = "⚠️ 유효한 사용자가 아닙니다.";
          return;
        }

        if (!manualDate || !manualTime) {
            statusDiv.innerText = "⚠️ 날짜와 시간을 모두 입력해주세요.";
            return;
        }
        
        if (status === '출근' && reason === "") {
            statusDiv.innerText = "⚠️ 출근 시에는 사유를 반드시 입력해주세요.";
            return;
        }
        
        document.getElementById('btn-checkin').disabled = true;
        document.getElementById('btn-checkout').disabled = true;
        statusDiv.innerText = "⏳ 위치 정보 수집 중... (브라우저 권한을 허용해주세요)";
        
        const hadDinner = false; // 저녁식사 여부 체크 기능 제거

        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              statusDiv.innerText = "📡 데이터를 서버로 전송 중입니다...";
              google.script.run
                .withSuccessHandler(updateStatus)
                .withFailureHandler(handleError)
                .recordAttendance(name, status, reason, manualDate, manualTime, position.coords.latitude, position.coords.longitude, position.coords.accuracy, hadDinner);
            }, 
            () => {
              statusDiv.innerText = "❌ 위치 정보를 가져올 수 없습니다. 위치 정보 없이 기록합니다.";
              recordWithoutLocation(name, status, reason, manualDate, manualTime, hadDinner);
            }, 
            { enableHighAccuracy: true, timeout: 10000 }
          );
        } else {
          statusDiv.innerText = "❌ 이 브라우저에서는 위치 정보를 지원하지 않습니다.";
          recordWithoutLocation(name, status, reason, manualDate, manualTime, hadDinner);
        }
      }

      function recordWithoutLocation(name, status, reason, manualDate, manualTime, hadDinner) {
        google.script.run
            .withSuccessHandler(updateStatus)
            .withFailureHandler(handleError)
            .recordAttendance(name, status, reason, manualDate, manualTime, null, null, null, hadDinner);
      }
      
      function updateStatus(message) {
        const statusDiv = document.getElementById('status');
        const mainDiv = document.getElementById('main');
        statusDiv.innerText = message;
        document.getElementById('btn-checkin').disabled = false;
        document.getElementById('btn-checkout').disabled = false;
        
        if (message.startsWith("✅")) {
            document.getElementById('reason').value = "";
            mainDiv.style.transition = 'background-color 0.3s';
            mainDiv.style.backgroundColor = '#d4edda';
            setTimeout(() => { mainDiv.style.backgroundColor = 'white'; }, 1500);
        }
      }

      function handleError(error) {
        const statusDiv = document.getElementById('status');
        const mainDiv = document.getElementById('main');
        statusDiv.innerText = '❌ 스크립트 오류: ' + error.message;
        document.getElementById('btn-checkin').disabled = false;
        document.getElementById('btn-checkout').disabled = false;
        
        mainDiv.style.transition = 'background-color 0.3s';
        mainDiv.style.backgroundColor = '#f8d7da';
        setTimeout(() => { mainDiv.style.backgroundColor = 'white'; }, 2000);
      }
    </script>
  </body>
</html>

CalculatorCode.gs
/**
 * @file Calculatorcode.gs
 * @description 근무시간 상세 계산 로직 담당
 */

function generateDetailSheet(month, employeeDataMap) {
    try {
        const [year, monthNum] = month.split('-').map(Number);
        const WEEKDAY_KOR = ['일', '월', '화', '수', '목', '금', '토'];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { holidays, leaveUsageData } = loadInputsForMonth_(month);
        const holidaysSet = new Set(holidays);
        
        const { standardHours: fullMonthStandardHours, actualStandardHours: fullMonthActualStandardHours } = calculateStandardHours_(year, monthNum, holidaysSet, null, null);
        
        const workDataResult = getEmployeeWorkData_(month);
        const employeeWorkData = workDataResult.paired;
        const unpairedData = workDataResult.unpaired;
        
        const flexSettings = getFlexWorkSettings_();
        let flexPeriodMessage = "";
        const reportStart = new Date(year, monthNum - 1, 1);
        const reportEnd = new Date(year, monthNum, 0);
        for (const setting of flexSettings) {
            if (reportStart <= setting.end && reportEnd >= setting.start) {
                const startStr = Utilities.formatDate(setting.start, CONFIG.TIMEZONE, "MM/dd");
                const endStr = Utilities.formatDate(setting.end, CONFIG.TIMEZONE, "MM/dd");
                flexPeriodMessage = `(탄력근로제 적용: ${startStr}~${endStr})`;
                break;
            }
        }

        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const dailyBreakdown = {};
        const allEmployeesInvolved = new Set([...employeeWorkData.keys(), ...Object.keys(leaveUsageData), ...unpairedData.keys(), ...employeeDataMap.keys()]);

        for (const employee of allEmployeesInvolved) {
            const employeeInfo = employeeDataMap.get(employee);
            const hireDate = employeeInfo ? employeeInfo.hireDate : null;
            const termDate = employeeInfo ? employeeInfo.termDate : null;

            const dailyData = employeeWorkData.get(employee) || new Map();
            const employeeUnpairedNotes = unpairedData.get(employee) || new Map();
            let weeklyWorkDays = 0;
            const employeeDailyRecords = [];
            const employeeLeaveUsageList = leaveUsageData[employee] || [];

            for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(year, monthNum - 1, day);
                
                if (currentDate >= today) break;

                if (hireDate && currentDate < hireDate) continue;
                if (termDate && currentDate > termDate) continue;

                const dateString = Utilities.formatDate(currentDate, CONFIG.TIMEZONE, "yyyy-MM-dd");
                const dayOfWeek = currentDate.getDay();
                const isHoliday = holidaysSet.has(dateString);
                const usedLeave = employeeLeaveUsageList.find(l => l.date === dateString);
                const unpairedNoteData = employeeUnpairedNotes.get(dateString);
                
                const dailyRecord = {
                    date: dateString, dayOfWeek: WEEKDAY_KOR[dayOfWeek], status: "", base: 0, extension: 0, night: 0,
                    substituteLeave: 0, compensatoryLeave: 0,
                    note: "", checkInTime: null, checkOutTime: null, source: "", breakTime: 0
                };

                if (usedLeave) {
                    const leaveDuration = usedLeave.duration === '전일' ? 8 : 4;
                    dailyRecord.status = `${usedLeave.type}(${usedLeave.duration})`;
                    dailyRecord.base = leaveDuration;
                }

                const workData = dailyData.get(dateString);
                if (workData) {
                    dailyRecord.source = workData.source;
                    let currentStatus = "정상근무";
                    if (usedLeave) currentStatus += "+근무";
                    if (workData.hadDinner) currentStatus += "+저녁";
                    dailyRecord.status = currentStatus;

                    const { start, end } = workData;
                    const startTime = new Date(year, monthNum - 1, day, parseInt(start.substring(0, 2)), parseInt(start.substring(2, 4)));
                    let endTime = new Date(year, monthNum - 1, day, parseInt(end.substring(0, 2)), parseInt(end.substring(2, 4)));
                    if (endTime < startTime) endTime.setDate(endTime.getDate() + 1);

                    dailyRecord.checkInTime = startTime;
                    dailyRecord.checkOutTime = endTime;
                    const workMinutes = (endTime - startTime) / (1000 * 60);

                    let breakMinutes = 0;
                    if (workMinutes >= 240) breakMinutes += 60;
                    if (workData.hadDinner) breakMinutes += 60;
                    dailyRecord.breakTime = breakMinutes;

                    const netWorkHours = (workMinutes - dailyRecord.breakTime) / 60;
                    
                    let nightHours = 0;
                    let tempTime = new Date(startTime.getTime());
                    while (tempTime < endTime) {
                        const currentHour = tempTime.getHours();
                        if (currentHour >= 22 || currentHour < 6) nightHours++;
                        tempTime.setHours(tempTime.getHours() + 1);
                    }
                    
                    const overtimeThreshold = getOvertimeThreshold_(currentDate, flexSettings);
                    
                    if (dayOfWeek === 6 || dayOfWeek === 0 || isHoliday) {
                        if(dayOfWeek === 6) { // 토요일
                            dailyRecord.substituteLeave = netWorkHours;
                        } else { // 일요일 또는 공휴일
                            let holidayExtension = Math.max(0, netWorkHours - 8);
                            dailyRecord.compensatoryLeave = ((netWorkHours - holidayExtension) * 1.5) + (holidayExtension * 2.0) + (nightHours * 0.5);
                        }
                        dailyRecord.base = netWorkHours;
                        dailyRecord.extension = 0;
                        dailyRecord.night = 0;
                    } else { // 평일
                        const totalHoursForDay = netWorkHours + (usedLeave && usedLeave.duration === '반일' ? 4 : 0);
                        const extension = Math.max(0, totalHoursForDay - overtimeThreshold);
                        dailyRecord.extension = extension;
                        dailyRecord.base = netWorkHours - extension;
                        dailyRecord.night = nightHours;
                    }
                }

                if (!workData && !usedLeave) {
                    if (unpairedNoteData) {
                        dailyRecord.status = unpairedNoteData.note;
                        dailyRecord.note = unpairedNoteData.note;
                        if (unpairedNoteData.note.includes('퇴근')) {
                            dailyRecord.checkInTime = unpairedNoteData.time;
                        } else {
                            dailyRecord.checkOutTime = unpairedNoteData.time;
                        }
                    } else {
                        if (isHoliday || dayOfWeek === 0) {
                            dailyRecord.status = "유급휴일";
                            dailyRecord.base = 8;
                        } else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                            dailyRecord.status = "결근";
                        }
                    }
                } else if (unpairedNoteData) {
                    dailyRecord.note = (dailyRecord.note ? `${dailyRecord.note}; ` : "") + unpairedNoteData.note;
                }

                if (dailyRecord.status || dailyRecord.note) employeeDailyRecords.push(dailyRecord);

                if (dayOfWeek === 0 || day === daysInMonth) {
                    if (weeklyWorkDays >= 5 || (weeklyWorkDays > 0 && day === daysInMonth && currentDate.getDay() !== 0)) {
                        for (let i = employeeDailyRecords.length - 1; i >= 0; i--) {
                            const rec = employeeDailyRecords[i];
                            const recDate = new Date(rec.date);
                            if (recDate.getDay() === 0 && (currentDate.getTime() - recDate.getTime()) < 7 * 24 * 60 * 60 * 1000) {
                                if (rec.status === '유급휴일') {
                                    rec.status = "주휴일";
                                    rec.note = "주휴수당 발생";
                                }
                                break;
                            }
                        }
                    }
                    weeklyWorkDays = 0;
                }
            }
            dailyBreakdown[employee] = employeeDailyRecords;
        }

        writeDailyBreakdownToSheet_(month, dailyBreakdown, fullMonthStandardHours, fullMonthActualStandardHours, flexPeriodMessage);
        
        return { success: true };

    } catch (e) {
        Logger.log(e.stack);
        return { success: false, error: e.toString() };
    }
}

function writeDailyBreakdownToSheet_(baseSheetName, breakdownData, standardHours, actualStandardHours, flexPeriodMessage) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const detailSheetName = CONFIG.SHEETS.DETAIL(baseSheetName);
    let detailSheet = ss.getSheetByName(detailSheetName);
    if (detailSheet) detailSheet.clear(); else detailSheet = ss.insertSheet(detailSheetName);

    let a1Text = `${baseSheetName} 기준 근로시간: ${standardHours}시간 (실근무일 기준: ${actualStandardHours}시간)`;
    if (flexPeriodMessage) a1Text += ` ${flexPeriodMessage}`;
    detailSheet.getRange("A1").setValue(a1Text).setFontColor('#999999').setFontSize(9);

    const headers = ['직원명', '날짜', '요일', '근무상태', '출근시간', '퇴근시간', '휴게(분)', '기본(h)', '연장(h)', '야간(h)', '발생대체(h)', '발생보상(h)', '비고'];
    const outputData = [["", ""], headers];

    const sortedEmployees = Object.keys(breakdownData).sort();
    for (const employee of sortedEmployees) {
        const records = breakdownData[employee];
        records.forEach((rec) => {
            let checkInStr = "", checkOutStr = "";
            if (rec.checkInTime) {
                checkInStr = Utilities.formatDate(rec.checkInTime, CONFIG.TIMEZONE, "HH:mm:ss");
            }
            if (rec.checkOutTime) {
                checkOutStr = rec.checkOutTime.getDate() !== (rec.checkInTime ? rec.checkInTime.getDate() : new Date(rec.date).getDate())
                    ? `(익일 ${Utilities.formatDate(rec.checkOutTime, CONFIG.TIMEZONE, "HH:mm:ss")})`
                    : Utilities.formatDate(rec.checkOutTime, CONFIG.TIMEZONE, "HH:mm:ss");
            }
            let finalNote = rec.note;
            if (rec.source) finalNote = (finalNote ? `${finalNote}; ` : "") + `출처: ${rec.source}`;
            
            const rowData = [
                employee, rec.date, rec.dayOfWeek, rec.status, checkInStr, checkOutStr,
                rec.breakTime || 0,
                roundToOneDecimal_(rec.base || 0), roundToOneDecimal_(rec.extension || 0),
                roundToOneDecimal_(rec.night || 0),
                roundToOneDecimal_(rec.substituteLeave || 0),
                roundToOneDecimal_(rec.compensatoryLeave || 0),
                finalNote
            ];
            outputData.push(rowData);
        });
    }
    if (outputData.length > 2) {
        detailSheet.getRange(2, 1, outputData.length - 1, headers.length).setValues(outputData.slice(1));
        detailSheet.getRange(2, 1, 1, headers.length).setFontWeight('bold').setHorizontalAlignment('center');
        detailSheet.getRange(3, 7, outputData.length - 2, 6).setNumberFormat("0.0");
        detailSheet.getRange(3, 7, outputData.length - 2, 1).setNumberFormat("0");
        detailSheet.setFrozenRows(2);
        detailSheet.autoResizeColumns(1, headers.length);
        const minWidth = 100;
        for (let i = 1; i <= headers.length; i++) {
            const customWidth = (i === 4 || i === headers.length) ? 140 : minWidth;
            if (detailSheet.getColumnWidth(i) < customWidth) detailSheet.setColumnWidth(i, customWidth);
        }
    }
}

function getEmployeeWorkData_(month) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dailyEvents = new Map();
    const unifiedSheetName = CONFIG.SHEETS.UNIFIED_LOGS(month);
    const unifiedSheet = ss.getSheetByName(unifiedSheetName);

    if (unifiedSheet && unifiedSheet.getLastRow() > 1) {
        const data = unifiedSheet.getRange(2, 1, unifiedSheet.getLastRow() - 1, 12).getValues();

        data.forEach(row => {
            const dateValue = row[0];
            const timeValue = row[1];
            const name = row[4].toString().trim();
            const mode = row[8];
            const hadDinner = row[11];

            if (!dateValue || !timeValue || !name || !mode) return;

            const date = new Date(dateValue);
            const timeStr = timeValue.toString().toUpperCase();
            const timeParts = timeStr.match(/(\d+):(\d+):(\d+)/);
            if (!timeParts) return;

            let hours = parseInt(timeParts[1], 10);
            const minutes = parseInt(timeParts[2], 10);
            if ((timeStr.includes('오후') || timeStr.includes('PM')) && hours !== 12) hours += 12;
            if ((timeStr.includes('오전') || timeStr.includes('AM')) && hours === 12) hours = 0;
            if (isNaN(date.getTime())) return;

            const timestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, parseInt(timeParts[3], 10));
            const dateString = Utilities.formatDate(date, CONFIG.TIMEZONE, "yyyy-MM-dd");
            const key = `${name}|${dateString}`;

            if (!dailyEvents.has(key)) {
                dailyEvents.set(key, { ins: [], outs: [], source: '기록' });
            }
            const dayEntry = dailyEvents.get(key);
            const record = { timestamp: timestamp, hadDinner: (hadDinner === 'O') };

            if (mode === '출근' || mode === '해제') {
                dayEntry.ins.push(record.timestamp);
            } else if (mode === '퇴근' || mode === '출입' || mode === '세트') {
                dayEntry.outs.push(record);
            }
        });
    }
    return buildShiftsFromDailyEvents_(dailyEvents);
}

function buildShiftsFromDailyEvents_(dailyEvents) {
    const processedData = new Map();
    const unpairedRecords = new Map();
    const employees = [...new Set(Array.from(dailyEvents.keys()).map(k => k.split('|')[0]))];

    employees.forEach(name => {
        const employeeDates = Array.from(dailyEvents.keys()).filter(k => k.startsWith(name + '|')).map(k => k.split('|')[1]).sort();
        const consolidatedDailyData = new Map();

        employeeDates.forEach(dateStr => {
            const key = `${name}|${dateStr}`;
            const dayData = dailyEvents.get(key);
            if (!consolidatedDailyData.has(dateStr)) {
                consolidatedDailyData.set(dateStr, {
                    allIns: dayData.ins.sort((a,b) => a-b),
                    allOuts: dayData.outs.sort((a,b) => a.timestamp - b.timestamp),
                    sources: []
                });
            } else {
              const consolidated = consolidatedDailyData.get(dateStr);
              consolidated.allIns.push(...dayData.ins);
              consolidated.allOuts.push(...dayData.outs);
              consolidated.allIns.sort((a,b) => a-b);
              consolidated.allOuts.sort((a,b) => a.timestamp - b.timestamp);
            }
            consolidatedDailyData.get(dateStr).sources.push(dayData.source);
        });

        const sortedDates = Array.from(consolidatedDailyData.keys()).sort();
        for (let i = 0; i < sortedDates.length; i++) {
            const dateStr = sortedDates[i];
            const dayData = consolidatedDailyData.get(dateStr);
            if (dayData.allIns.length === 0 && dayData.allOuts.length === 0) continue;

            const earliestIn = dayData.allIns.length > 0 ? dayData.allIns[0] : null;
            let latestOutRecord = dayData.allOuts.length > 0 ? dayData.allOuts[dayData.allOuts.length - 1] : null;
            let isPaired = false;

            if (earliestIn && !latestOutRecord) {
                const nextDateStr = sortedDates[i + 1];
                if (nextDateStr) {
                    const nextDayData = consolidatedDailyData.get(nextDateStr);
                    if (nextDayData && nextDayData.allOuts.length > 0) {
                        const earliestNextDayIn = nextDayData.allIns.length > 0 ? nextDayData.allIns[0] : null;
                        let potentialOutRecord = earliestNextDayIn ? nextDayData.allOuts.find(out => out.timestamp < earliestNextDayIn) : nextDayData.allOuts[0];
                        if (potentialOutRecord) {
                            latestOutRecord = potentialOutRecord;
                            nextDayData.allOuts.splice(nextDayData.allOuts.indexOf(potentialOutRecord), 1);
                        }
                    }
                }
            }

            if (earliestIn && latestOutRecord) {
                isPaired = true;
                if (!processedData.has(name)) processedData.set(name, new Map());
                const combinedSource = [...new Set(dayData.sources)].join('+');
                processedData.get(name).set(dateStr, {
                    start: Utilities.formatDate(earliestIn, CONFIG.TIMEZONE, "HHmm"),
                    end: Utilities.formatDate(latestOutRecord.timestamp, CONFIG.TIMEZONE, "HHmm"),
                    source: combinedSource,
                    hadDinner: latestOutRecord.hadDinner
                });
            }

            if (!isPaired) {
                if (!unpairedRecords.has(name)) unpairedRecords.set(name, new Map());
                if (dayData.allIns.length > 0 && dayData.allOuts.length === 0) {
                    unpairedRecords.get(name).set(dateStr, { note: "퇴근 기록 누락", time: dayData.allIns[0] });
                } else if (dayData.allIns.length === 0 && dayData.allOuts.length > 0) {
                    unpairedRecords.get(name).set(dateStr, { note: "출근 기록 누락", time: dayData.allOuts[dayData.allOuts.length - 1].timestamp });
                }
            }
        }
    });
    return { paired: processedData, unpaired: unpairedRecords };
}

function loadInputsForMonth_(month) {
    if (!month) return { holidays: [], leaveUsageData: {} };
    const year = month.split('-')[0];
    const inputSheetName = CONFIG.SHEETS.INPUT_VALUES(year);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(inputSheetName);
    if (!sheet || sheet.getLastRow() < 2) return { holidays: [], leaveUsageData: {} };
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
    const holidays = [];
    const leaveUsageData = {};
    data.forEach(row => {
        const dateValue = new Date(row[0]);
        if (isNaN(dateValue.getTime())) return;
        const itemDateStr = Utilities.formatDate(dateValue, CONFIG.TIMEZONE, "yyyy-MM-dd");
        if (itemDateStr.startsWith(month)) {
            const type = row[1];
            if (type === '공휴일') {
                holidays.push(itemDateStr);
            } else if (type === '휴가사용') {
                const employee = row[2];
                if (!employee) return;
                if (!leaveUsageData[employee]) leaveUsageData[employee] = [];
                leaveUsageData[employee].push({ date: itemDateStr, duration: row[3], type: row[4] });
            }
        }
    });
    return { holidays: holidays, leaveUsageData: leaveUsageData };
}

function calculateStandardHours_(year, monthNum, holidaysSet, hireDate = null, termDate = null) {
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    let workDays = 0, paidHolidays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, monthNum - 1, day);
        
        if (hireDate && currentDate < hireDate) continue;
        if (termDate && currentDate > termDate) continue;

        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek > 0 && dayOfWeek < 6) {
            if (holidaysSet.has(Utilities.formatDate(currentDate, CONFIG.TIMEZONE, "yyyy-MM-dd"))) {
                paidHolidays++;
            } else {
                workDays++;
            }
        } else if (dayOfWeek === 0) {
            paidHolidays++;
        }
    }
    return { standardHours: (workDays + paidHolidays) * 8, actualStandardHours: workDays * 8 };
}

function getFlexWorkSettings_() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
        if (!settingsSheet || settingsSheet.getLastRow() < 2) return [];
        const settings = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).getValues();
        return settings.map(row => ({ start: new Date(row[0]), end: new Date(row[1]) })).filter(s => !isNaN(s.start.getTime()) && !isNaN(s.end.getTime()));
    } catch (e) {
        Logger.log("설정 시트 에러: " + e);
        return [];
    }
}

function getOvertimeThreshold_(date, flexSettings) {
    for (const setting of flexSettings) {
        if (date >= setting.start && date <= setting.end) return 12; 
    }
    return 8;
}

function getAvailableRawMonths() {
    const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    const monthSet = new Set();
    const regex = /^(\d{4}-\d{2})-기록$/;
    sheets.forEach(sheet => {
        const sheetName = sheet.getName();
        const match = sheetName.match(regex);
        if (match) monthSet.add(match[1]);
    });
    return Array.from(monthSet).sort().reverse();
}

function roundToOneDecimal_(value) { return Math.round(value * 10) / 10; }

WorkTimeViewerUI.html
<!DOCTYPE html>
<html>
<head>
    <base target="_top">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>개인 근무시간 조회</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 20px; background-color: #f8f9fa; margin: 0; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; font-size: 24px; }
        .user-info { background-color: #e9ecef; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
        .user-info strong { color: #495057; font-size: 18px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: bold; color: #495057; }
        select { width: 100%; padding: 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 16px; background-color: white; }
        button { width: 100%; padding: 15px; background-color: #007bff; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: background-color 0.2s; }
        button:hover:not(:disabled) { background-color: #0056b3; }
        button:disabled { background-color: #6c757d; cursor: not-allowed; }
        .loading, .error { text-align: center; padding: 12px; border-radius: 6px; margin: 15px 0; }
        .loading { color: #6c757d; }
        .error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .work-time-data { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; }
        .data-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #dee2e6; }
        .data-row:last-child { border-bottom: none; }
        .data-label { font-weight: bold; color: #495057; }
        .data-value { font-size: 18px; color: #007bff; font-weight: bold; }
        .last-updated { text-align: center; color: #6c757d; font-size: 14px; margin-top: 10px; font-style: italic; }
        .details-container { margin-top: 25px; }
        .details-toggle { font-weight: bold; color: #007bff; cursor: pointer; user-select: none; padding: 10px; background-color: #e6f3ff; border-radius: 8px; text-align: center; }
        .details-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .details-table th, .details-table td { padding: 10px; text-align: center; border-bottom: 1px solid #dee2e6; font-size: 14px; vertical-align: middle; }
        .details-table th { background-color: #f2f2f2; font-weight: bold; }
        .missing-record { background-color: #fff3cd !important; }
        .missing-note { color: #dc3545; font-weight: bold; }
        .input-group { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .time-input { padding: 4px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; width: 80px; }
        .submit-btn { padding: 5px 10px; font-size: 12px; width: auto; background-color: #28a745; }
        .submit-btn:hover:not(:disabled) { background-color: #218838; }
        .dinner-btn { background-color: #ffc107; color: #212529; }
        .dinner-btn:hover:not(:disabled) { background-color: #e0a800; }
        #toast { visibility: hidden; min-width: 250px; margin-left: -125px; background-color: #333; color: #fff; text-align: center; border-radius: 8px; padding: 16px; position: fixed; z-index: 10; left: 50%; bottom: 30px; font-size: 16px; opacity: 0; transition: visibility 0s, opacity 0.5s linear; }
        #toast.show { visibility: visible; opacity: 1; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 개인 근무시간 조회</h1>
        <div id="user-info-section" class="user-info" style="display: none;"><strong id="user-name"></strong>님, 안녕하세요!</div>
        <div id="loading-section" class="loading">사용자 정보를 확인 중입니다...</div>
        <div id="error-section" class="error" style="display: none;"><span id="error-message"></span></div>
        <div id="main-section" style="display: none;">
            <div class="form-group">
                <label for="month-select">조회할 월 선택</label>
                <select id="month-select"></select>
            </div>
            <button id="search-btn" onclick="searchWorkTime()" disabled>근무시간 조회</button>
            <div id="loading-search" class="loading" style="display: none;">데이터를 조회 중입니다...</div>
            <div id="work-time-result" style="display: none;">
                <div class="work-time-data">
                    <h3 id="result-title"></h3>
                    <div class="data-row" style="background-color: #f8f9fa; padding: 10px; border-radius: 6px; border-left: 4px solid #28a745;">
                        <span class="data-label" style="color: #28a745;">📋 해당 월 기준 정보</span>
                        <span id="a1-text" style="font-size: 14px; color: #495057; text-align: right; white-space: pre-line;">-</span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">일평균 근무시간</span>
                        <span class="data-value" id="daily-average">-</span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">실근무시간 (출근일만)</span>
                        <span class="data-value" id="actual-total">-</span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">인정시간 (유급휴가 포함)</span>
                        <span class="data-value" id="grand-total">-</span>
                    </div>
                    <div class="last-updated" id="l1-text">-</div>
                </div>

                <div class="details-container">
                    <details open>
                        <summary class="details-toggle">상세 근무내역 보기/숨기기</summary>
                        <table class="details-table">
                            <!-- [수정] 테이블 헤더 변경 -->
                            <thead><tr><th>날짜</th><th>요일</th><th>근무유형</th><th>출근</th><th>퇴근</th><th>비고</th><th>작업</th></tr></thead>
                            <tbody id="details-tbody"></tbody>
                        </table>
                    </details>
                </div>
            </div>
        </div>
    </div>
    <div id="toast"></div>

    <script>
        let currentUser = null;
        let lastClickedButton = null;
        
        document.addEventListener('DOMContentLoaded', () => {
            google.script.run.withSuccessHandler(handleUserInfoSuccess).withFailureHandler(handleError).getCurrentUserInfo();
        });

        function handleUserInfoSuccess(userInfo) {
            document.getElementById('loading-section').style.display = 'none';
            if (userInfo.success) {
                currentUser = userInfo;
                document.getElementById('user-name').textContent = userInfo.name;
                document.getElementById('user-info-section').style.display = 'block';
                loadAvailableMonths();
            } else {
                showError(userInfo.error);
            }
        }

        function loadAvailableMonths() {
            google.script.run.withSuccessHandler(handleMonthsSuccess).withFailureHandler(handleError).getAvailableWorkTimeMonths();
        }

        function handleMonthsSuccess(result) {
            if (result.success) {
                const select = document.getElementById('month-select');
                select.innerHTML = '<option value="">-- 월 선택 --</option>';
                result.months.forEach(month => {
                    const option = document.createElement('option');
                    option.value = month.key;
                    option.textContent = month.displayName;
                    select.appendChild(option);
                });
                select.addEventListener('change', () => { document.getElementById('search-btn').disabled = !select.value; });
                document.getElementById('main-section').style.display = 'block';
            } else {
                showError(result.error);
            }
        }

        function searchWorkTime() {
            const selectedMonth = document.getElementById('month-select').value;
            if (!selectedMonth) return;
            document.getElementById('loading-search').style.display = 'block';
            document.getElementById('work-time-result').style.display = 'none';
            document.getElementById('search-btn').disabled = true;
            google.script.run.withSuccessHandler(handleWorkTimeSuccess).withFailureHandler(handleError).getPersonalWorkTimeDataWithDetails(selectedMonth, currentUser.name);
        }

        function handleWorkTimeSuccess(result) {
            document.getElementById('loading-search').style.display = 'none';
            document.getElementById('search-btn').disabled = false;
            if (result.success) {
                displayWorkTimeData(result.data);
            } else {
                showError(result.error);
            }
        }

        function displayWorkTimeData(data) {
            const { summary, details } = data;
            
            document.getElementById('result-title').textContent = `${summary.monthKey.split('-')[0]}년 ${summary.monthKey.split('-')[1]}월 근무시간`;
            document.getElementById('a1-text').textContent = summary.a1Text || "정보 없음";
            document.getElementById('l1-text').textContent = summary.l1Text || "정보 없음";
            document.getElementById('daily-average').textContent = (summary.dailyAverage || 0).toFixed(1) + '시간';
            document.getElementById('actual-total').textContent = (summary.actualTotal || 0).toFixed(1) + '시간';
            document.getElementById('grand-total').textContent = (summary.grandTotal || 0).toFixed(1) + '시간';

            const tbody = document.getElementById('details-tbody');
            tbody.innerHTML = ''; 
            if (details && details.length > 0) {
                details.forEach(rec => {
                    const tr = document.createElement('tr');
                    const isTimeMissing = rec.note && rec.note.includes('누락');
                    
                    let noteCellHtml = rec.note || '--';
                    if (isTimeMissing) {
                        noteCellHtml = `<span class="missing-note">${rec.note}</span>`;
                        tr.classList.add('missing-record');
                    } else if (rec.isDinnerMissing) {
                        noteCellHtml = `<span class="missing-note">저녁식사 기록 누락</span>`;
                        tr.classList.add('missing-record');
                    }

                    let actionCellHtml = '--';
                    if (isTimeMissing) {
                        const recordType = rec.note.includes('출근') ? '출근' : '퇴근';
                        actionCellHtml = `<div class="input-group"><input type="time" id="timeInput-${rec.date}" class="time-input"><button onclick="submitMissingRecord(this, '${rec.date}', '${recordType}')" class="submit-btn">${recordType} 입력</button></div>`;
                    } else if (rec.isDinnerMissing) {
                        actionCellHtml = `<button onclick="addDinner(this, '${rec.date}')" class="submit-btn dinner-btn">저녁식사 추가</button>`;
                    }
                    
                    // [수정] 테이블 행 내용 변경
                    tr.innerHTML = `<td>${rec.date.substring(5)}</td><td>${rec.dayOfWeek}</td><td>${rec.status}</td><td>${rec.checkin || '--'}</td><td>${rec.checkout || '--'}</td><td>${noteCellHtml}</td><td>${actionCellHtml}</td>`;
                    tbody.appendChild(tr);
                });
            } else {
                // [수정] colspan 변경
                tbody.innerHTML = '<tr><td colspan="7">상세 근무 내역이 없습니다.</td></tr>';
            }
            document.getElementById('work-time-result').style.display = 'block';
        }

        function submitMissingRecord(btn, dateString, recordType) {
            const timeInput = document.getElementById(`timeInput-${dateString}`);
            if (!timeInput.value) {
                showToast("시간을 입력해주세요.", true);
                return;
            }
            lastClickedButton = btn;
            btn.disabled = true;
            showToast("기록을 전송하는 중입니다...");
            google.script.run.withSuccessHandler(onRecordAdded).withFailureHandler(handleError).addMissingRecord(currentUser.name, dateString, timeInput.value, recordType);
        }

        function addDinner(btn, dateString) {
            lastClickedButton = btn;
            btn.disabled = true;
            showToast("저녁식사 기록을 추가하는 중입니다...");
            google.script.run.withSuccessHandler(onRecordAdded).withFailureHandler(handleError).addDinnerRecord(currentUser.name, dateString);
        }

        function onRecordAdded(result) {
            showToast(result);
            if (result.startsWith("✅") && lastClickedButton) {
                lastClickedButton.textContent = '전송완료';
                const inputGroup = lastClickedButton.parentElement;
                if (inputGroup && inputGroup.classList.contains('input-group')) {
                    const timeInput = inputGroup.querySelector('.time-input');
                    if (timeInput) timeInput.disabled = true;
                }
            } else if (lastClickedButton) {
                lastClickedButton.disabled = false;
            }
            lastClickedButton = null;
        }

        function handleError(error) {
            document.getElementById('loading-search').style.display = 'none';
            document.getElementById('search-btn').disabled = false;
            if (lastClickedButton) {
                lastClickedButton.disabled = false;
                lastClickedButton = null;
            }
            showError((error && error.message) ? error.message : '알 수 없는 오류가 발생했습니다.');
        }

        function showError(message) {
            const errorSection = document.getElementById('error-section');
            document.getElementById('error-message').textContent = message;
            errorSection.style.display = 'block';
        }

        function showToast(message, isError = false) {
            const toast = document.getElementById("toast");
            toast.textContent = message;
            toast.style.backgroundColor = isError ? '#dc3545' : '#333';
            toast.className = "show";
            setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
        }
    </script>
</body>
</html>


