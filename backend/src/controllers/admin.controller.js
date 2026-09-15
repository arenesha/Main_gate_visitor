const { changePin } = require('../services/admin.service');
const {
  getAllVisitors,
  createVisitor,
  updateVisitor,
  deleteVisitor
} = require('../services/visitor.service');
const { getAllEntries } = require('../services/entry.service');
const {
  getNotificationsByAuthorizationId,
  checkNotificationHealth
} = require('../services/notification.service');

async function handleChangePin(req, res) {
  try {
    const { currentPin, newPin, confirmNewPin } = req.body;
    const result = await changePin({ currentPin, newPin, confirmNewPin });
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function handleGetVisitors(req, res) {
  try {
    const search = req.query.search || '';
    const visitors = await getAllVisitors(search);
    return res.status(200).json({ success: true, visitors });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function handleCreateVisitor(req, res) {
  try {
    const { name, email, phone, active } = req.body;
    const visitor = await createVisitor({ name, email, phone, active });
    return res.status(201).json({ success: true, visitor, message: 'Visitor added successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function handleUpdateVisitor(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, email, phone, active } = req.body;
    const visitor = await updateVisitor(id, { name, email, phone, active });
    return res.status(200).json({ success: true, visitor, message: 'Visitor updated successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function handleDeleteVisitor(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await deleteVisitor(id);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function handleGetEntries(req, res) {
  try {
    const entries = await getAllEntries();
    return res.status(200).json({ success: true, entries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function handleDownloadExcel(req, res) {
  try {
    const fs = require('fs');
    const { EXCEL_FILE_PATH } = require('../services/excel.service');
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      return res.status(404).json({ success: false, message: 'Excel record file does not exist yet. Verify an entry at the gate first.' });
    }
    return res.download(EXCEL_FILE_PATH, 'visitor-entry-records.xlsx');
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function handleGetNotifications(req, res) {
  try {
    const { authorizationId } = req.params;
    const notifications = await getNotificationsByAuthorizationId(authorizationId);
    return res.status(200).json({ success: true, notifications });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function handleNotificationHealth(req, res) {
  try {
    const health = await checkNotificationHealth();
    return res.status(200).json(health);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  handleChangePin,
  handleGetVisitors,
  handleCreateVisitor,
  handleUpdateVisitor,
  handleDeleteVisitor,
  handleGetEntries,
  handleDownloadExcel,
  handleGetNotifications,
  handleNotificationHealth
};
