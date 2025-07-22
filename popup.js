console.log('Popup loaded');

// Elements
const statusDiv = document.getElementById('status');
const captureBtn = document.getElementById('capture-btn');
const captureRegionBtn = document.getElementById('capture-region-btn');
const newSessionBtn = document.getElementById('new-session-btn');
const viewAllBtn = document.getElementById('view-all-btn');
const sessionNameDiv = document.getElementById('session-name');
const sessionStatsDiv = document.getElementById('session-stats');
const screenshotsDiv = document.getElementById('screenshots');
const voiceBtn = document.getElementById('voice-btn');
const transcriptDiv = document.getElementById('transcript');
const transcriptText = document.getElementById('transcript-text');

let currentSession = null;
let recognition = null;
let isRecording = false;
let currentTranscript = '';

// Initialize popup
async function init() {
  await loadSession();
  await loadScreenshots();
  await checkStorage();
  setupVoiceRecognition();
  await checkRecordingState();
  displayKeyboardShortcuts();
}

// Check if recording is active (from keyboard shortcut)
async function checkRecordingState() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getRecordingState' });
    if (response.success && response.isRecording) {
      isRecording = true;
      voiceBtn.textContent = '⏹️ Stop Recording';
      voiceBtn.style.background = '#4caf50';
      transcriptDiv.style.display = 'block';
      transcriptText.textContent = response.currentTranscript || 'Recording via keyboard shortcut...';
      transcriptText.style.color = '#333';
      
      // Start speech recognition to sync with keyboard recording
      if (recognition && !recognition.started) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          recognition.start();
        } catch (e) {
          console.log('Could not start speech recognition:', e);
        }
      }
    }
  } catch (error) {
    console.error('Error checking recording state:', error);
  }
}

// Display keyboard shortcuts info
function displayKeyboardShortcuts() {
  const shortcutsDiv = document.createElement('div');
  shortcutsDiv.style.cssText = 'margin-top: 10px; padding: 8px; background: #e8f5e9; border-radius: 4px; font-size: 11px;';
  shortcutsDiv.innerHTML = `
    <strong>Keyboard Shortcuts:</strong><br>
    Alt+Shift+S - Full screenshot<br>
    Alt+Shift+R - Region screenshot<br>
    Alt+Shift+V - Toggle recording<br>
    Alt+Shift+D - Open dashboard
  `;
  document.body.appendChild(shortcutsDiv);
}

// Check storage usage
async function checkStorage() {
  chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
    const quota = chrome.storage.local.QUOTA_BYTES || 5242880;
    const percentUsed = (bytesInUse / quota) * 100;
    const mb = (bytesInUse / 1024 / 1024).toFixed(2);
    
    const storageInfo = document.getElementById('storage-info');
    storageInfo.textContent = `Storage: ${mb}MB used (${percentUsed.toFixed(0)}%)`;
    
    if (percentUsed > 80) {
      storageInfo.style.color = '#f44336';
      storageInfo.textContent += ' - Nearly full!';
    } else if (percentUsed > 60) {
      storageInfo.style.color = '#ff9800';
    }
  });
}

// Load current session
async function loadSession() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCurrentSession' });
    if (response.success && response.session) {
      currentSession = response.session;
      sessionNameDiv.textContent = currentSession.name;
      sessionStatsDiv.textContent = `${currentSession.screenshotCount} screenshots`;
    } else {
      sessionNameDiv.textContent = 'No active session';
      sessionStatsDiv.textContent = 'Click "New Session" to start';
    }
  } catch (error) {
    console.error('Error loading session:', error);
    statusDiv.textContent = 'Error loading session';
  }
}

// Load screenshots
async function loadScreenshots() {
  try {
    const { screenshots = {} } = await chrome.storage.local.get('screenshots');
    const screenshotArray = Object.values(screenshots)
      .filter(s => !currentSession || s.sessionId === currentSession.id)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
    
    if (screenshotArray.length === 0) {
      screenshotsDiv.innerHTML = '<p style="text-align: center; color: #999;">No screenshots yet</p>';
    } else {
      screenshotsDiv.innerHTML = screenshotArray.map(s => `
        <div class="screenshot-thumb" data-id="${s.id}">
          <img src="${s.imageData}" alt="Screenshot ${s.sequenceNumber}">
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading screenshots:', error);
  }
}

// Create new session
newSessionBtn.addEventListener('click', async () => {
  const name = prompt('Enter session name:', `Session ${new Date().toLocaleString()}`);
  if (!name) return;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'createSession',
      name: name
    });
    
    if (response.success) {
      currentSession = response.session;
      await loadSession();
      await loadScreenshots();
      statusDiv.textContent = 'New session created';
    }
  } catch (error) {
    console.error('Error creating session:', error);
    statusDiv.textContent = 'Error creating session';
  }
});

// Capture screenshot
captureBtn.addEventListener('click', async () => {
  if (!currentSession) {
    statusDiv.textContent = 'Please create a session first';
    return;
  }
  
  captureBtn.disabled = true;
  statusDiv.textContent = 'Capturing...';
  
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send capture request to background
    const response = await chrome.runtime.sendMessage({
      action: 'captureScreenshot',
      tab: tab
    });
    
    if (response.success) {
      statusDiv.textContent = `Screenshot #${response.screenshot.sequenceNumber} captured!`;
      await loadSession();
      await loadScreenshots();
      await checkStorage();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('Capture error:', error);
    statusDiv.textContent = 'Error: ' + error.message;
  } finally {
    captureBtn.disabled = false;
  }
});

// Capture region screenshot
captureRegionBtn.addEventListener('click', async () => {
  if (!currentSession) {
    statusDiv.textContent = 'Please create a session first';
    return;
  }
  
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send message to content script to start selection
    await chrome.tabs.sendMessage(tab.id, { action: 'startRegionSelection' });
    
    // Close popup to allow selection
    window.close();
  } catch (error) {
    console.error('Region capture error:', error);
    statusDiv.textContent = 'Error: Make sure you\'re on a regular webpage';
  }
});

// View all screenshots - open dashboard
viewAllBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'dashboard.html' });
  window.close();
});

// Setup voice recognition
function setupVoiceRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      console.log('Voice recognition started');
      transcriptDiv.style.display = 'block';
      transcriptText.textContent = 'Listening...';
      transcriptText.style.color = '#333';
    };
    
    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      
      currentTranscript = finalTranscript || currentTranscript;
      transcriptText.textContent = currentTranscript + interimTranscript;
      
      // Send updated transcript to background
      if (currentTranscript) {
        chrome.runtime.sendMessage({
          action: 'updateTranscript',
          text: currentTranscript + interimTranscript
        });
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Voice recognition error:', event.error);
      statusDiv.textContent = 'Voice error: ' + event.error;
      stopRecording();
    };
    
    recognition.onend = () => {
      console.log('Voice recognition ended');
      if (isRecording) {
        recognition.start(); // Restart if still recording
      }
    };
  } else {
    voiceBtn.disabled = true;
    voiceBtn.textContent = '🎤 Not Supported';
  }
}

// Voice recording button
voiceBtn.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

async function startRecording() {
  if (!recognition) return;
  
  try {
    // Request microphone permission first
    await navigator.mediaDevices.getUserMedia({ audio: true });
    
    recognition.start();
    isRecording = true;
    voiceBtn.textContent = '⏹️ Stop Recording';
    voiceBtn.style.background = '#4caf50';
    currentTranscript = '';
    
    // Save transcript start
    chrome.runtime.sendMessage({
      action: 'startTranscript',
      sessionId: currentSession?.id
    });
  } catch (error) {
    console.error('Error starting recognition:', error);
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      statusDiv.textContent = 'Microphone access denied. Please allow microphone access.';
      alert('Microphone access is required for voice recording.\n\nPlease:\n1. Click the lock icon in the address bar\n2. Allow microphone access\n3. Reload the extension');
    } else {
      statusDiv.textContent = 'Error: ' + error.message;
    }
  }
}

function stopRecording() {
  if (!recognition) return;
  
  recognition.stop();
  isRecording = false;
  voiceBtn.textContent = '🎤 Start Recording';
  voiceBtn.style.background = '#f44336';
  
  if (currentTranscript) {
    // Save transcript
    chrome.runtime.sendMessage({
      action: 'saveTranscript',
      text: currentTranscript,
      sessionId: currentSession?.id
    });
    
    statusDiv.textContent = 'Transcript saved';
  }
}

// Clear all data button
document.getElementById('clear-data-btn').addEventListener('click', async () => {
  if (confirm('This will delete all sessions, screenshots, and transcripts. Are you sure?')) {
    try {
      // Clear all storage
      await chrome.storage.local.clear();
      
      // Reset UI
      currentSession = null;
      sessionNameDiv.textContent = 'No active session';
      sessionStatsDiv.textContent = 'Click "New Session" to start';
      screenshotsDiv.innerHTML = '<p style="text-align: center; color: #999;">No screenshots yet</p>';
      statusDiv.textContent = 'All data cleared';
      
      // Update storage info
      await checkStorage();
      
      // Notify background script
      chrome.runtime.sendMessage({ action: 'clearAllData' });
    } catch (error) {
      console.error('Error clearing data:', error);
      statusDiv.textContent = 'Error clearing data';
    }
  }
});

// Privacy link handler
document.getElementById('privacy-link').addEventListener('click', (e) => {
  e.preventDefault();
  // Open your privacy policy URL here
  // chrome.tabs.create({ url: 'YOUR_PRIVACY_POLICY_URL' });
  alert('Privacy Policy: This extension captures screenshots of web pages when you activate it. All data is stored locally on your device and is never sent to external servers. You control what is captured and when.');
});

// Initialize on load
init();