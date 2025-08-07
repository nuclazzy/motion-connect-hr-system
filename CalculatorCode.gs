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
