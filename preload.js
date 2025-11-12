// This file is intentionally minimal
// It provides a secure bridge between main and renderer processes
// For this app, we're using direct fetch() calls from renderer
// which is safe since we're only accessing Airtable API

window.addEventListener('DOMContentLoaded', () => {
    console.log('Command Center loaded successfully');
  });