const fs=require('node:fs'),path=require('node:path');
fs.copyFileSync(path.join(__dirname,'practice-schedule.js'),path.join(__dirname,'backend/practice-schedule.js'));
console.log('Shared Friday deadline and activity rules copied for the draft API.');
