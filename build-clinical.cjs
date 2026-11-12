const fs=require('node:fs');const path=require('node:path');
const root=__dirname;let html=fs.readFileSync(path.join(root,fs.existsSync(path.join(root,'legacy.html'))?'legacy.html':'index.html'),'utf8');
const boot=/\(async\(\)=>\{\s*const restored = await restoreSessionIfPossible\(\);\s*if \(!restored\) loadPublicStats\(\);\s*\}\)\(\);/;
if(!boot.test(html))throw new Error('Legacy bootstrap marker changed; inspect before building.');
html=html.replace(boot,'/* Authentication is supplied by the account portal. */');
html=html.replace('        loadPendingSyncs();','        /* Pending requests are owned by the parent portal. */').replace('        loadState();','        /* No legacy browser state is loaded in the embedded form. */');
html=html.replace(/<script src="(?:reports|shifts)\.js[^\"]*"><\/script>/g,'');
html=html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/xlsx[^\"]*"><\/script>/,'');
html=html.replace('</head>','<style>#coverScreen{display:none!important}.app-header{position:static!important}.dash-sidebar{top:0!important}@media screen{body{background:#f6f7f3!important}}</style></head>');
html=html.replace('</body>','<script src="clinical-bridge.js"></script></body>');
// Empty text is an intentional edit; preserve it when capturing forms.
html=html.replace(/(a\.(?:fisik|diagnosis|implementasi)=document\.getElementById\('[^']+'\)\?\.value) \|\| a\.(?:fisik|diagnosis|implementasi) \|\| '';/g,"$1 ?? '';");
html=html.replace("#page-instrumen .option-chip').forEach", "#page-instrumen .option-chip,#page-instrumen input').forEach");
html=html.replace("if (item?.min !== undefined) value = Math.max(value, Number(item.min));\n                if (item?.max !== undefined) value = Math.min(value, Number(item.max));", "if (!Number.isFinite(value) || item?.min !== undefined && value < Number(item.min) || item?.max !== undefined && value > Number(item.max)) { toast('Nilai di luar rentang instrumen. Periksa pengukuran; nilai belum disimpan.'); renderActiveInstrumen(); return; }");
html=html.replace('placeholder="Nama lengkap"','placeholder="Kode kasus, tanpa nama lengkap"');
html=html.replace('</head>','<style>@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}</style></head>');
fs.writeFileSync(path.join(root,'clinical.html'),html);console.log('Built clinical.html preserving all clinical definitions.');
