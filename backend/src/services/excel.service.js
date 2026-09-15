const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const rawExcelPath = process.env.EXCEL_FILE_PATH || 'backend/data/visitor-entry-records.xlsx';
const EXCEL_FILE_PATH = path.isAbsolute(rawExcelPath)
  ? rawExcelPath
  : path.resolve(process.cwd(), rawExcelPath);

const HEADERS = ['Visitor Name(s)', 'Entry Date', 'Entry Time', 'Authorization Status', 'Entry Status'];

async function appendEntryToExcel({ visitorNames, entryDate, entryTime, authorizationStatus, entryStatus }) {
  const dir = path.dirname(EXCEL_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const workbook = new ExcelJS.Workbook();
  let worksheet;

  if (fs.existsSync(EXCEL_FILE_PATH)) {
    await workbook.xlsx.readFile(EXCEL_FILE_PATH);
    worksheet = workbook.getWorksheet('Visitor Entries') || workbook.addWorksheet('Visitor Entries');
    if (worksheet.rowCount === 0) {
      const headerRow = worksheet.addRow(HEADERS);
      headerRow.font = { bold: true };
    }
  } else {
    worksheet = workbook.addWorksheet('Visitor Entries');
    const headerRow = worksheet.addRow(HEADERS);
    headerRow.font = { bold: true };
  }

  const formattedNames = Array.isArray(visitorNames) ? visitorNames.join(', ') : visitorNames;

  worksheet.addRow([
    formattedNames,
    entryDate,
    entryTime,
    authorizationStatus,
    entryStatus
  ]);

  worksheet.columns.forEach((col) => {
    col.width = 24;
  });

  await workbook.xlsx.writeFile(EXCEL_FILE_PATH);
  logger.info(`[EXCEL SUCCESS] Appended verified entry for "${formattedNames}" to ${EXCEL_FILE_PATH}`);
}

module.exports = {
  appendEntryToExcel,
  EXCEL_FILE_PATH
};
