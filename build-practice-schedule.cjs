const fs=require('node:fs'),path=require('node:path');
fs.copyFileSync(path.join(__dirname,'practice-schedule.js'),path.join(__dirname,'backend/practice-schedule.js'));
const source=fs.readFileSync(path.join(__dirname,'practice-schedule.js'),'utf8');
fs.writeFileSync(path.join(__dirname,'backend/practice-schedule.ts'),source.slice(source.indexOf(" 'use strict';"),source.lastIndexOf(' return {deadlines'))+'\nexport {deadlines,activity,matches,deadlineLabel};\n');
console.log('Shared Friday deadline and activity rules copied for the draft API.');