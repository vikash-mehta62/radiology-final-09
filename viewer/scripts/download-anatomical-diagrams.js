/**
 * Robust downloader for anatomical diagrams from Wikimedia Commons
 * - Tries exact File:... names
 * - If not found, searches Commons by keyword and picks first File:* result (SVG ideally)
 * - Skips already-downloaded files
 * - Writes resolved-files.json and missing-files.json
 *
 * Run: node viewer/scripts/download-anatomical-diagrams.js
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_AGENT = 'radiology-viewer/1.0 (https://your-repo.example/; your-email@example.com)';

const SVG_LINKS = {
  "FullBody": {
    "neutral_frontal": "File:Human_body_silhouette.svg",
    "female_frontal": "File:Silhouette_of_a_woman.svg"
  },
  "HeadBrain": {
    "axial": "File:Brain_axial_section.svg",
    "sagittal": "File:Brain_sagittal_section.svg",
    "coronal": "File:Brain_coronal_section.svg"
  },
  "Chest": {
    "frontal": "File:Rib_cage_icon.svg",
    "lateral": "File:Human_thorax_lateral_view_silhouette.svg",
    "axial": "File:Spinal_cord_-_Thoracic_cross_section.svg"
  },
  "Abdomen": {
    "frontal": "File:Abdomen_silhouette.svg",
    "quadrants": "File:Abdominal_quadrants.svg"
  },
  "Spine": {
    "lateral": "File:Spine_simple.svg",
    "frontal": "File:Human_spine_diagram.svg"
  },
  "Pelvis": {
    "frontal": "File:Pelvis_icon.svg"
  },
  "Extremities": {
    "hand": "File:Hand_bones.svg",
    "shoulder": "File:Shoulder_joint.svg",
    "knee": "File:Knee_icon.svg"
  }
};

const diagramsDir = path.join(__dirname, '../public/diagrams');
if (!fs.existsSync(diagramsDir)) fs.mkdirSync(diagramsDir, { recursive: true });

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Invalid JSON response from ${url}: ${err.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function getDirectSVGUrl(fileName) {
  // fileName is expected like "File:Something.svg"
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&format=json`;
  const json = await httpGetJson(apiUrl);
  if (!json || !json.query || !json.query.pages) throw new Error('No query result');
  const page = Object.values(json.query.pages)[0];
  if (page && page.imageinfo && page.imageinfo[0] && page.imageinfo[0].url) {
    return page.imageinfo[0].url;
  }
  throw new Error(`No image info for ${fileName}`);
}

async function searchCommons(keyword, limit = 5) {
  // Search Commons for the keyword (returns list of titles)
  // We will prefer results that begin with "File:" (namespace 6)
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(keyword)}&srlimit=${limit}&format=json`;
  const json = await httpGetJson(apiUrl);
  const results = (json.query && json.query.search) ? json.query.search : [];
  // Convert search results into likely File: titles
  const titles = results.map(r => r.title);
  return titles;
}

async function downloadSVG(url, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': '*/*'
      }
    }, (res) => {
      // Follow redirects
      if (res.statusCode === 302 || res.statusCode === 301) {
        return downloadSVG(res.headers.location, outputPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: ${res.statusCode} ${res.statusMessage}`));
      }
      const file = fs.createWriteStream(outputPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', reject);
    }).on('error', reject);
  });
}

function fileAlreadyExists(name) {
  return fs.existsSync(path.join(diagramsDir, name));
}

function prettyOutputFilename(bodyPart, view) {
  // e.g., chest-axial.svg
  return `${bodyPart.toLowerCase()}-${view}.svg`.replace(/\s+/g, '_');
}

async function resolveAndDownload(bodyPart, view, desiredFileName) {
  const outputFileName = prettyOutputFilename(bodyPart, view);
  const outputPath = path.join(diagramsDir, outputFileName);

  if (fileAlreadyExists(outputFileName)) {
    return { success: true, skipped: true, reason: 'already exists', outputFileName };
  }

  // 1) Try exact filename first (if it starts with File:)
  let triedCandidates = [];
  if (desiredFileName && desiredFileName.startsWith('File:')) {
    triedCandidates.push(desiredFileName);
    try {
      const url = await getDirectSVGUrl(desiredFileName);
      await downloadSVG(url, outputPath);
      return { success: true, triedCandidates, resolvedTo: desiredFileName, outputFileName };
    } catch (err) {
      // continue to search fallback
    }
  }

  // 2) Search fallback: strip leading File: if present, use keywords
  const keyword = desiredFileName ? desiredFileName.replace(/^File:/i, '').replace(/_/g, ' ').replace(/\.svg$/i, '') : `${bodyPart} ${view}`;
  let searchTitles = [];
  try {
    searchTitles = await searchCommons(keyword, 8);
  } catch (err) {
    // search failed
  }

  // prefer titles that start with "File:"
  const fileCandidates = searchTitles.filter(t => /^File:/i.test(t));

  // If none start with File:, try to map search result titles to potential file pages by prefixing "File:"
  if (fileCandidates.length === 0) {
    for (const t of searchTitles) {
      // sometimes search returns "Rib cage" etc — try building variants
      const tryTitle = `File:${t}`;
      fileCandidates.push(tryTitle);
    }
  }

  // Deduplicate
  const uniqueCandidates = [...new Set(fileCandidates)];
  for (const cand of uniqueCandidates) {
    triedCandidates.push(cand);
    try {
      const url = await getDirectSVGUrl(cand);
      // Prefer SVG URLs but accept other image types
      await downloadSVG(url, outputPath);
      return { success: true, triedCandidates, resolvedTo: cand, outputFileName };
    } catch (err) {
      // try next candidate
    }
  }

  // 3) If still not found, return failed with list of tried candidates
  return { success: false, triedCandidates, reason: 'not found', outputFileName };
}

async function downloadAllDiagrams() {
  console.log('📥 Downloading anatomical diagrams from Wikimedia Commons...\n');

  const missing = [];
  const resolved = [];
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (const [bodyPart, views] of Object.entries(SVG_LINKS)) {
    console.log(`\n📍 ${bodyPart}:`);
    for (const [view, fileName] of Object.entries(views)) {
      if (!fileName) {
        console.log(`  ⏭️  ${view}: Skipped (no file specified)`);
        continue;
      }

      process.stdout.write(`  🔍 ${view}: `);
      try {
        const res = await resolveAndDownload(bodyPart, view, fileName);
        if (res.success && res.skipped) {
          console.log(`Already exists → ${res.outputFileName}`);
          skippedCount++;
          resolved.push({ bodyPart, view, requested: fileName, resolvedTo: null, status: 'skipped' });
        } else if (res.success) {
          console.log(`Downloaded → ${res.outputFileName} (resolved: ${res.resolvedTo || fileName})`);
          successCount++;
          resolved.push({ bodyPart, view, requested: fileName, resolvedTo: res.resolvedTo || fileName, output: res.outputFileName });
        } else {
          console.log(`Failed → tried: ${res.triedCandidates.join(' | ')}`);
          failCount++;
          missing.push({ bodyPart, view, requested: fileName, tried: res.triedCandidates });
        }
      } catch (err) {
        console.log(`Error: ${err.message}`);
        failCount++;
        missing.push({ bodyPart, view, requested: fileName, error: err.message });
      }

      // polite delay
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`  ✅ Downloaded: ${successCount}`);
  console.log(`  ⏭️ Skipped (already present): ${skippedCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log(`\n✨ Diagrams saved to: ${diagramsDir}`);

  // Write outputs
  fs.writeFileSync(path.join(diagramsDir, 'resolved-files.json'), JSON.stringify(resolved, null, 2));
  fs.writeFileSync(path.join(diagramsDir, 'missing-files.json'), JSON.stringify(missing, null, 2));
  if (missing.length) {
    console.log(`\n⚠️ Missing files saved to missing-files.json (open and review suggested replacements)`);
  } else {
    console.log(`\n✅ All requested files resolved or already present.`);
  }
}

// run
downloadAllDiagrams().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
