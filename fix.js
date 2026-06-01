const fs = require('fs');
let c = fs.readFileSync('public/dj_live.html', 'utf8');

c = c.replace(/if \(\s+&&\s+\.classList\.contains\('on'\)\) \{ toggleTracklist\(\); \}\s+\}/g, 'if (document.getElementById("overlay") && document.getElementById("overlay").classList.contains("on")) { toggleTracklist(); }\n  }');

fs.writeFileSync('public/dj_live.html', c);
