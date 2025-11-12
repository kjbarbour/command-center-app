// config.js
require('dotenv').config();

function must(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  AIRTABLE_TOKEN: must('AIRTABLE_TOKEN'),
  AIRTABLE_BASE_ID: must('AIRTABLE_BASE_ID'),
  AIRTABLE_TABLE_NAME: process.env.AIRTABLE_TABLE_NAME || 'Tasks',
  ANTHROPIC_API_KEY: must('ANTHROPIC_API_KEY'),
  PORT: parseInt(process.env.PORT || '4001', 10),
};