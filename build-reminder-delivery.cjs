const fs=require('node:fs'),path=require('node:path');
fs.copyFileSync(path.join(__dirname,'reminder-delivery.js'),path.join(__dirname,'backend/reminder-delivery.js'));
console.log('Canonical delivery engine copied for the draft Edge worker.');
