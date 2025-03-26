// CommonJS adapter for Vercel
const fs = require('fs');
const path = require('path');

function createLogsDirectory() {
  try {
    if (!fs.existsSync('./debugging_logs')) {
      fs.mkdirSync('./debugging_logs', { recursive: true });
    }
    return true;
  } catch (error) {
    console.error('Failed to create debugging_logs directory:', error);
    return false;
  }
}

function writeLog(filename, data) {
  try {
    fs.writeFileSync(path.join('./debugging_logs', filename), JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to write log:', error);
    return false;
  }
}

function readFile(filepath) {
  try {
    return fs.readFileSync(filepath, 'utf8');
  } catch (error) {
    console.error('Failed to read file:', error);
    return null;
  }
}

module.exports = {
  createLogsDirectory,
  writeLog,
  readFile
}; 