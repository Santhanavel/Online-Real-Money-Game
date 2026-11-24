const https = require('https');
const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/santh/.gemini/antigravity/brain/59a3513c-0034-40a8-8948-12bb7907ec32/storyboards_pool';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

https.get('https://www.youtube.com/watch?v=hlx85PQFiBE', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const match = data.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!match) return console.log('No ytInitialPlayerResponse match');
    const json = JSON.parse(match[1]);
    const spec = json.storyboards?.playerStoryboardSpecRenderer?.spec;
    if (!spec) return console.log('No spec found');

    const parts = spec.split('|');
    const baseUrl = parts[0];
    
    // Level 3 is 390x180 thumbnails in 3x3 grids (part 4)
    const pLevel = parts[4] || parts[3];
    const levelIndex = parts[4] ? '3' : '2';
    const subParts = pLevel.split('#');
    const sigh = subParts[7];
    const count = parseInt(subParts[2], 10);
    const gridCols = parseInt(subParts[3], 10);
    const gridRows = parseInt(subParts[4], 10);
    const perSheet = gridCols * gridRows;
    const numSheets = Math.ceil(count / perSheet);

    console.log(`Downloading ${numSheets} storyboard sheets (Level ${levelIndex}, ${gridCols}x${gridRows} per sheet, total ${count} frames)...`);

    for (let i = 0; i < Math.min(numSheets, 10); i++) {
      let url = baseUrl.replace('$L', levelIndex).replace('$N', 'M' + i) + '&sigh=' + sigh;
      const dest = path.join(dir, `sheet_${i}.jpg`);
      
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (imgRes) => {
        if (imgRes.statusCode === 200) {
          const file = fs.createWriteStream(dest);
          imgRes.pipe(file);
          file.on('finish', () => console.log(`Saved sheet_${i}.jpg (${fs.statSync(dest).size} bytes)`));
        } else {
          console.log(`Failed sheet_${i} status: ${imgRes.statusCode}`);
        }
      });
    }
  });
});
