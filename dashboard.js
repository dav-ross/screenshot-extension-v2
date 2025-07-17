console.log('Dashboard loaded');

let allScreenshots = {};
let allTranscripts = {};
let sessions = {};
let currentSessionFilter = '';

// Initialize dashboard
async function init() {
  await loadData();
  populateSessionSelector();
  renderScreenshots();
  setupEventListeners();
}

// Load all data from storage
async function loadData() {
  const data = await chrome.storage.local.get(['screenshots', 'transcripts', 'sessions']);
  allScreenshots = data.screenshots || {};
  allTranscripts = data.transcripts || {};
  
  // Extract sessions from screenshots
  sessions = {};
  Object.values(allScreenshots).forEach(screenshot => {
    if (screenshot.sessionId && !sessions[screenshot.sessionId]) {
      sessions[screenshot.sessionId] = {
        id: screenshot.sessionId,
        name: `Session ${screenshot.sessionId}`,
        screenshotCount: 0
      };
    }
    if (screenshot.sessionId) {
      sessions[screenshot.sessionId].screenshotCount++;
    }
  });
  
  // Load actual session data if available
  const storedSession = await chrome.storage.local.get('currentSession');
  if (storedSession.currentSession) {
    sessions[storedSession.currentSession.id] = storedSession.currentSession;
  }
}

// Populate session selector
function populateSessionSelector() {
  const select = document.getElementById('session-select');
  select.innerHTML = '<option value="">All Sessions</option>';
  
  Object.values(sessions).forEach(session => {
    const option = document.createElement('option');
    option.value = session.id;
    option.textContent = `${session.name} (${session.screenshotCount} screenshots)`;
    select.appendChild(option);
  });
}

// Render screenshots grid
function renderScreenshots() {
  const grid = document.getElementById('screenshots-grid');
  const emptyState = document.getElementById('empty-state');
  
  // Filter screenshots by session
  let screenshots = Object.values(allScreenshots);
  if (currentSessionFilter) {
    screenshots = screenshots.filter(s => s.sessionId === currentSessionFilter);
  }
  
  // Sort by timestamp (newest first)
  screenshots.sort((a, b) => b.timestamp - a.timestamp);
  
  if (screenshots.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  grid.style.display = 'grid';
  emptyState.style.display = 'none';
  
  grid.innerHTML = screenshots.map(screenshot => {
    const date = new Date(screenshot.timestamp);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString();
    
    return `
      <div class="screenshot-card" data-id="${screenshot.id}">
        <img class="screenshot-image" src="${screenshot.imageData}" alt="Screenshot">
        <div class="screenshot-info">
          <div class="screenshot-title">${screenshot.title || 'Untitled'}</div>
          <div class="screenshot-meta">
            ${screenshot.type === 'region' ? '📐 Region' : '📸 Full Page'} • ${dateStr} ${timeStr}
          </div>
          <div class="screenshot-meta">
            Sequence #${screenshot.sequenceNumber || '-'}
          </div>
          ${screenshot.transcript ? `
            <div class="screenshot-transcript">
              <strong>🎤 Transcript:</strong><br>
              ${screenshot.transcript}
            </div>
          ` : ''}
          <div class="screenshot-actions">
            <button class="view-btn" data-id="${screenshot.id}">View Full Size</button>
            <button class="delete-btn" data-id="${screenshot.id}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add event listeners to buttons after rendering
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => viewScreenshot(btn.dataset.id));
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteScreenshot(btn.dataset.id));
  });
}

// View screenshot in modal
function viewScreenshot(id) {
  const screenshot = allScreenshots[id];
  if (!screenshot) return;
  
  const modal = document.getElementById('modal');
  const modalImage = document.getElementById('modal-image');
  
  modalImage.src = screenshot.imageData;
  modal.style.display = 'block';
}

// Delete screenshot
async function deleteScreenshot(id) {
  if (!confirm('Are you sure you want to delete this screenshot?')) return;
  
  delete allScreenshots[id];
  await chrome.storage.local.set({ screenshots: allScreenshots });
  
  // Update session count
  await loadData();
  populateSessionSelector();
  renderScreenshots();
}

// Setup event listeners
function setupEventListeners() {
  // Session filter
  document.getElementById('session-select').addEventListener('change', (e) => {
    currentSessionFilter = e.target.value;
    renderScreenshots();
  });
  
  // Modal close
  document.getElementById('modal').addEventListener('click', () => {
    document.getElementById('modal').style.display = 'none';
  });
  
  // Export button
  document.getElementById('export-package').addEventListener('click', exportAsPackage);
  
  // Clear all button
  document.getElementById('clear-all-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete ALL screenshots? This cannot be undone.')) {
      await chrome.storage.local.remove(['screenshots', 'transcripts']);
      await loadData();
      populateSessionSelector();
      renderScreenshots();
      alert('All screenshots have been deleted.');
    }
  });
}

// Export functions
function getFilteredData() {
  let screenshots = Object.values(allScreenshots);
  if (currentSessionFilter) {
    screenshots = screenshots.filter(s => s.sessionId === currentSessionFilter);
  }
  screenshots.sort((a, b) => a.timestamp - b.timestamp);
  
  return screenshots;
}

function exportAsHTML() {
  const data = getFilteredData();
  const sessionName = currentSessionFilter ? sessions[currentSessionFilter]?.name : 'All Sessions';
  
  let html = `<!DOCTYPE html>
<html>
<head>
  <title>Screenshot Export - ${sessionName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .screenshot { margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; }
    .screenshot img { max-width: 100%; height: auto; }
    .metadata { color: #666; font-size: 14px; margin: 10px 0; }
    .transcript { background: #f0f7ff; padding: 10px; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>Screenshot Export - ${sessionName}</h1>
  <p>Exported on ${new Date().toLocaleString()}</p>
`;
  
  data.forEach((screenshot, index) => {
    html += `
  <div class="screenshot">
    <h2>Screenshot #${screenshot.sequenceNumber || index + 1}</h2>
    <div class="metadata">
      <strong>Title:</strong> ${screenshot.title || 'Untitled'}<br>
      <strong>URL:</strong> ${screenshot.url || 'N/A'}<br>
      <strong>Type:</strong> ${screenshot.type || 'full'}<br>
      <strong>Captured:</strong> ${new Date(screenshot.timestamp).toLocaleString()}
    </div>
    <img src="${screenshot.imageData}" alt="Screenshot">
    ${screenshot.transcript ? `
      <div class="transcript">
        <strong>Transcript:</strong><br>
        ${screenshot.transcript}
      </div>
    ` : ''}
  </div>
`;
  });
  
  html += `</body></html>`;
  
  downloadFile(html, `screenshots-${sessionName.replace(/\s+/g, '-')}.html`, 'text/html');
}

function exportAsJSON() {
  const data = getFilteredData();
  const sessionName = currentSessionFilter ? sessions[currentSessionFilter]?.name : 'All Sessions';
  
  const exportData = {
    session: sessionName,
    exportDate: new Date().toISOString(),
    screenshots: data
  };
  
  downloadFile(
    JSON.stringify(exportData, null, 2), 
    `screenshots-${sessionName.replace(/\s+/g, '-')}.json`, 
    'application/json'
  );
}

function exportAsMarkdown() {
  const data = getFilteredData();
  const sessionName = currentSessionFilter ? sessions[currentSessionFilter]?.name : 'All Sessions';
  
  let markdown = `# Screenshot Export - ${sessionName}\n\n`;
  markdown += `Exported on ${new Date().toLocaleString()}\n\n`;
  
  data.forEach((screenshot, index) => {
    markdown += `## Screenshot #${screenshot.sequenceNumber || index + 1}\n\n`;
    markdown += `- **Title:** ${screenshot.title || 'Untitled'}\n`;
    markdown += `- **URL:** ${screenshot.url || 'N/A'}\n`;
    markdown += `- **Type:** ${screenshot.type || 'full'}\n`;
    markdown += `- **Captured:** ${new Date(screenshot.timestamp).toLocaleString()}\n\n`;
    
    if (screenshot.transcript) {
      markdown += `### Transcript\n\n`;
      markdown += `${screenshot.transcript}\n\n`;
    }
    
    markdown += `![Screenshot ${index + 1}](data:image/png;base64,${screenshot.imageData.split(',')[1]})\n\n`;
    markdown += `---\n\n`;
  });
  
  downloadFile(markdown, `screenshots-${sessionName.replace(/\s+/g, '-')}.md`, 'text/markdown');
}

function exportForChatGPT() {
  const data = getFilteredData();
  const sessionName = currentSessionFilter ? sessions[currentSessionFilter]?.name : 'All Sessions';
  
  let html = `<!DOCTYPE html>
<html>
<head>
  <title>Screenshots for AI Analysis - ${sessionName}</title>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .screenshot-section {
      background: white;
      margin: 20px 0;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .screenshot-header {
      font-size: 18px;
      font-weight: bold;
      color: #333;
      margin-bottom: 10px;
    }
    .screenshot-description {
      background: #e3f2fd;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 15px;
      font-size: 16px;
      line-height: 1.5;
    }
    .screenshot-image {
      max-width: 100%;
      height: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .no-description {
      color: #999;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>Screenshot Documentation - ${sessionName}</h1>
  <p>Generated on ${new Date().toLocaleString()}</p>
  <p style="background: #fff3cd; padding: 10px; border-radius: 4px;">
    <strong>Instructions for AI:</strong> Each section below contains a screenshot with its description. 
    The description provides context about what the screenshot shows and what tests or actions should be considered.
  </p>
`;
  
  data.forEach((screenshot, index) => {
    const description = screenshot.transcript || 'No description provided';
    
    html += `
  <div class="screenshot-section">
    <div class="screenshot-header">Screenshot ${index + 1} of ${data.length}</div>
    <div class="screenshot-description">
      ${screenshot.transcript ? `<strong>Description:</strong> ${description}` : '<span class="no-description">No description available for this screenshot</span>'}
    </div>
    <img class="screenshot-image" src="${screenshot.imageData}" alt="Screenshot ${index + 1}">
  </div>
`;
  });
  
  html += `
</body>
</html>`;
  
  downloadFile(html, `chatgpt-screenshots-${sessionName.replace(/\s+/g, '-')}-${Date.now()}.html`, 'text/html');
}

function exportAsText() {
  const data = getFilteredData();
  const sessionName = currentSessionFilter ? sessions[currentSessionFilter]?.name : 'All Sessions';
  
  let text = `SCREENSHOT DESCRIPTIONS FOR AI ANALYSIS\n`;
  text += `Session: ${sessionName}\n`;
  text += `Generated: ${new Date().toLocaleString()}\n`;
  text += `Total Screenshots: ${data.length}\n`;
  text += `${'='.repeat(50)}\n\n`;
  
  text += `INSTRUCTIONS FOR AI:\n`;
  text += `This document contains descriptions of UI screenshots for test generation.\n`;
  text += `Each entry describes what is visible in the screenshot and what should be tested.\n`;
  text += `${'='.repeat(50)}\n\n`;
  
  data.forEach((screenshot, index) => {
    text += `SCREENSHOT ${index + 1}\n`;
    text += `-`.repeat(30) + `\n`;
    text += `Page Title: ${screenshot.title || 'Untitled'}\n`;
    text += `Page URL: ${screenshot.url || 'N/A'}\n`;
    text += `Capture Type: ${screenshot.type || 'full'}\n`;
    text += `Timestamp: ${new Date(screenshot.timestamp).toLocaleString()}\n`;
    text += `\nDescription:\n`;
    text += screenshot.transcript || '[No description provided]';
    text += `\n\n`;
  });
  
  text += `${'='.repeat(50)}\n`;
  text += `END OF DOCUMENT`;
  
  downloadFile(text, `screenshot-descriptions-${sessionName.replace(/\s+/g, '-')}-${Date.now()}.txt`, 'text/plain');
}

async function exportAsPackage() {
  const data = getFilteredData();
  const sessionName = currentSessionFilter ? sessions[currentSessionFilter]?.name : 'All Sessions';
  
  if (data.length === 0) {
    alert('No screenshots to export');
    return;
  }
  
  // Ask about compression first
  const compress = confirm('Compress images for smaller file sizes?\n\nOK = Yes (JPEG format)\nCancel = No (PNG format)');
  const extension = compress ? '.jpg' : '.png';
  
  // Create manifest content
  let manifest = `AI TEST GENERATION MANIFEST\n`;
  manifest += `${'='.repeat(50)}\n`;
  manifest += `Session: ${sessionName}\n`;
  manifest += `Generated: ${new Date().toLocaleString()}\n`;
  manifest += `Total Screenshots: ${data.length}\n`;
  manifest += `Image Format: ${compress ? 'JPEG (compressed)' : 'PNG (original)'}\n\n`;
  manifest += `INSTRUCTIONS FOR CHATGPT:\n`;
  manifest += `1. This manifest describes ${data.length} screenshot(s)\n`;
  manifest += `2. Each entry includes a description of what the screenshot shows\n`;
  manifest += `3. Screenshots are numbered screenshot-1${extension}, screenshot-2${extension}, etc.\n`;
  manifest += `4. Use these descriptions to understand the UI and generate appropriate tests\n`;
  manifest += `${'='.repeat(50)}\n\n`;
  
  // Add descriptions for each screenshot
  data.forEach((screenshot, index) => {
    const filename = `screenshot-${index + 1}${extension}`;
    
    manifest += `SCREENSHOT ${index + 1}: ${filename}\n`;
    manifest += `-`.repeat(40) + `\n`;
    manifest += `Page Title: ${screenshot.title || 'Untitled'}\n`;
    manifest += `Page URL: ${screenshot.url || 'N/A'}\n`;
    manifest += `Capture Type: ${screenshot.type === 'region' ? 'Region Selection' : 'Full Page'}\n`;
    manifest += `Timestamp: ${new Date(screenshot.timestamp).toLocaleString()}\n`;
    manifest += `\nDescription:\n${screenshot.transcript || '[No description provided - analyze the visual elements in the screenshot]'}\n`;
    manifest += `\n${'='.repeat(50)}\n\n`;
  });
  
  manifest += `HOW TO USE THIS EXPORT:\n`;
  manifest += `1. Upload this manifest.txt file to ChatGPT first\n`;
  manifest += `2. Then upload the screenshot images as needed\n`;
  manifest += `3. Ask ChatGPT to generate tests based on the descriptions and images\n`;
  
  // Download manifest
  downloadFile(manifest, `manifest-${sessionName.replace(/\s+/g, '-')}-${Date.now()}.txt`, 'text/plain');
  
  // Download screenshots
  setTimeout(() => {
    data.forEach((screenshot, index) => {
      setTimeout(async () => {
        await downloadScreenshot(screenshot.imageData, `screenshot-${index + 1}${extension}`, compress);
      }, index * 300);
    });
  }, 500);
}

async function compressImage(dataUrl, maxWidth = 800) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate new dimensions - more aggressive sizing
      let width = img.width;
      let height = img.height;
      
      // Always resize if larger than maxWidth
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      
      // Also limit height
      const maxHeight = 600;
      if (height > maxHeight) {
        width = (maxHeight / height) * width;
        height = maxHeight;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to JPEG with lower quality for smaller files
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.6); // 60% quality for smaller files
    };
    img.src = dataUrl;
  });
}

async function downloadScreenshot(dataUrl, filename, compress = true) {
  try {
    let imageData = dataUrl;
    
    if (compress) {
      // Show compression status
      console.log('Compressing image...');
      imageData = await compressImage(dataUrl);
    }
    
    // Convert to blob
    const base64 = imageData.split(',')[1];
    const mimeType = imageData.match(/data:([^;]+);/)[1];
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    // Change extension to .jpg if compressed
    const finalFilename = compress ? filename.replace('.png', '.jpg') : filename;
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading screenshot:', error);
  }
}

function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Initialize on load
init();