import * as XLSX from 'xlsx';

const EXCEL_STORAGE_KEY = 'arene_visitor_excel_records';

/**
 * Clear all persistent visitor records from local Excel database
 */
export function clearStoredVisitorRecords() {
  try {
    localStorage.removeItem(EXCEL_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear excel records from localStorage', e);
  }
}

/**
 * Retrieve all persistent visitor records from local Excel database
 */
export function getStoredVisitorRecords() {
  try {
    const raw = localStorage.getItem(EXCEL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read excel records from localStorage', e);
    return [];
  }
}

/**
 * Automatically append a new visitor pass row into the persistent Excel log
 */
export function appendVisitorToExcelLog(record) {
  try {
    const existing = getStoredVisitorRecords();
    const dateObj = new Date(record.created_at || Date.now());
    
    const newEntry = {
      pass_id: record.id,
      visitor_name: record.visitor_name || 'N/A',
      mobile_number: record.visitor_phone || 'N/A',
      email: record.visitor_email || 'N/A',
      aadhaar_number: record.aadhaar_number || 'N/A',
      vehicle_number: record.vehicle_number || 'N/A',
      purpose: record.purpose || 'N/A',
      host_name: record.host_name || 'N/A',
      company: record.company || 'AreneSHA',
      office_location: record.host_department || 'B-Block, MEENAKSHI TECH PARK, 11th, Gachibowli, Hyderabad, Telangana 500032',
      date: dateObj.toLocaleDateString('en-GB'),
      time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      authorization_status: record.status || 'ACTIVE',
      sms_status: record.sms_status || (record.visitor_phone ? 'Ready' : 'Not Provided'),
      email_status: record.email_status || (record.visitor_email ? 'Dispatched' : 'Not Provided'),
      entry_pin: record.entry_code || 'N/A',
      valid_from: record.valid_from,
      valid_until: record.valid_until,
      pass_url: `${window.location.origin}/invitation/${record.id}`,
      timestamp: dateObj.toISOString()
    };

    // Filter out duplicates if already exists
    const updated = [newEntry, ...existing.filter(item => item.pass_id !== record.id)];
    localStorage.setItem(EXCEL_STORAGE_KEY, JSON.stringify(updated));
    return newEntry;
  } catch (e) {
    console.error('Failed to append to excel log', e);
    return null;
  }
}

/**
 * Export array of visitor records to formatted native Microsoft Excel (.xlsx) file
 */
export function exportInvitationsToXLSX(records, filename = 'AreneSHA_Visitor_Log.xlsx') {
  const dataToExport = records && records.length > 0 ? records : getStoredVisitorRecords();

  if (!dataToExport || dataToExport.length === 0) {
    alert('No visitor records found in Excel log.');
    return;
  }

  const rows = dataToExport.map((item, index) => ({
    'S.No': index + 1,
    'Pass ID': item.pass_id || item.id,
    'Visitor Full Name': item.visitor_name,
    'Mobile Number': item.mobile_number || item.visitor_phone || 'N/A',
    'Email Address': item.email || item.visitor_email || 'N/A',
    'Aadhaar Number': item.aadhaar_number || 'N/A',
    'Vehicle Number': item.vehicle_number || 'None',
    'Purpose of Visit': item.purpose,
    'Host / Inviter Name': item.host_name,
    'Office / Company': item.company || 'AreneSHA',
    'Destination / Location': item.office_location || item.host_department || 'Meenakshi Tech Park',
    'Date': item.date || new Date(item.created_at || Date.now()).toLocaleDateString('en-GB'),
    'Time': item.time || new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    'Authorization Status': item.authorization_status || item.status || 'ACTIVE',
    '6-Digit Entry PIN': item.entry_pin || item.entry_code,
    'SMS Status': item.sms_status || 'Ready',
    'Email Status': item.email_status || 'Dispatched',
    'Pass URL': item.pass_url || `${window.location.origin}/invitation/${item.id}`
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Column width configuration for clean Excel viewing
  worksheet['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 14 }, // Pass ID
    { wch: 22 }, // Visitor Name
    { wch: 16 }, // Mobile Number
    { wch: 26 }, // Email
    { wch: 16 }, // Aadhaar
    { wch: 16 }, // Vehicle
    { wch: 24 }, // Purpose
    { wch: 20 }, // Host Name
    { wch: 16 }, // Company
    { wch: 36 }, // Office Location
    { wch: 14 }, // Date
    { wch: 12 }, // Time
    { wch: 20 }, // Authorization Status
    { wch: 14 }, // Entry PIN
    { wch: 18 }, // SMS Status
    { wch: 18 }, // Email Status
    { wch: 38 }  // Pass URL
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Visitor Access Log');

  XLSX.writeFile(workbook, filename);
}

/**
 * Format and download single visitor pass into an individual Excel (.xlsx) file
 */
export function exportSinglePassToXLSX(record, customFilename) {
  if (!record) return;
  const filename = customFilename || `Visitor_Pass_${record.id || record.pass_id}_${(record.visitor_name || 'Pass').replace(/\s+/g, '_')}.xlsx`;
  exportInvitationsToXLSX([record], filename);
}
