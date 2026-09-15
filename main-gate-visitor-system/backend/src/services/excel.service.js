const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Initializes the Excel workbook or loads existing one
 */
async function getWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(filePath)) {
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet('Visitor Entries') || workbook.worksheets[0];
    if (sheet && !sheet.columns?.length) {
      sheet.columns = [
        { header: 'Visitor Name(s)', key: 'visitorNames', width: 32 },
        { header: 'Entry Date', key: 'entryDate', width: 16 },
        { header: 'Entry Time', key: 'entryTime', width: 16 },
        { header: 'Authorization Status', key: 'authStatus', width: 22 },
        { header: 'Entry Status', key: 'entryStatus', width: 22 },
        { header: 'Authorization Reference', key: 'authRef', width: 26 }
      ];
    }
  } else {
    // Create new sheet with headers and styling
    const sheet = workbook.addWorksheet('Visitor Entries');
    sheet.columns = [
      { header: 'Visitor Name(s)', key: 'visitorNames', width: 32 },
      { header: 'Entry Date', key: 'entryDate', width: 16 },
      { header: 'Entry Time', key: 'entryTime', width: 16 },
      { header: 'Authorization Status', key: 'authStatus', width: 22 },
      { header: 'Entry Status', key: 'entryStatus', width: 22 },
      { header: 'Authorization Reference', key: 'authRef', width: 26 }
    ];

    // Header styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0284C7' } // Blue primary
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;
    await workbook.xlsx.writeFile(filePath);
  }

  return workbook;
}

/**
 * Appends a verified gate entry row into Excel
 * Returns: { success: boolean, error?: string }
 */
async function appendEntryToExcel({ visitorNames, verifiedAt, authorizationId }) {
  try {
    const filePath = env.EXCEL_FILE_PATH;
    const workbook = await getWorkbook(filePath);
    let sheet = workbook.getWorksheet('Visitor Entries') || workbook.worksheets[0];

    const dateObj = new Date(verifiedAt || Date.now());
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const entryDate = `${day}-${month}-${year}`;

    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    const entryTime = `${hours}:${minutes}:${seconds}`;

    const namesStr = Array.isArray(visitorNames) ? visitorNames.join(', ') : visitorNames;

    // Check if reference already exists to prevent duplicate rows
    let alreadyExists = false;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && row.getCell(6).value === authorizationId) {
        alreadyExists = true;
      }
    });

    if (alreadyExists) {
      logger.warn(`Excel record already exists for reference ${authorizationId}. Skipping duplicate append.`);
      return { success: true, skipped: true };
    }

    const row = sheet.addRow([
      namesStr,
      entryDate,
      entryTime,
      'AUTHORIZED',
      'ENTRY AUTHORIZED',
      authorizationId
    ]);

    // Row styling
    row.alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(5).font = { bold: true, color: { argb: 'FF16A34A' } }; // Green text for Entry Status
    row.getCell(6).font = { bold: true }; // Bold for Auth Ref

    await workbook.xlsx.writeFile(filePath);
    logger.info(`Excel entry appended for ${authorizationId} in ${filePath}`);
    return { success: true };
  } catch (err) {
    logger.error('Failed to write entry to Excel file:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  appendEntryToExcel
};
