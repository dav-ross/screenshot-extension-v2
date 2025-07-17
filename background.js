console.log('Background service worker started');

let currentSession = null;
let activeTranscript = null;
let isRecording = false;
let currentTranscriptText = '';

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request, 'from:', sender);
  
  // Handle async operations
  (async () => {
    try {
      switch (request.action) {
        case 'test':
          sendResponse({ success: true, message: 'Background is working!' });
          break;
          
        case 'getCurrentSession':
          if (!currentSession) {
            const stored = await chrome.storage.local.get('currentSession');
            currentSession = stored.currentSession;
          }
          sendResponse({ success: true, session: currentSession });
          break;
          
        case 'createSession':
          currentSession = {
            id: Date.now().toString(),
            name: request.name || `Session ${new Date().toLocaleString()}`,
            created: Date.now(),
            screenshotCount: 0
          };
          await chrome.storage.local.set({ currentSession });
          sendResponse({ success: true, session: currentSession });
          break;
          
        case 'captureScreenshot':
          const result = await captureScreenshot(request.tab);
          sendResponse({ success: true, screenshot: result });
          break;
          
        case 'captureRegion':
          // When called from content script, use sender.tab
          const tabForRegion = sender.tab || request.tab;
          if (!tabForRegion) {
            throw new Error('No tab information available');
          }
          const regionResult = await captureScreenshot(tabForRegion, 'region', request.region);
          sendResponse({ success: true, screenshot: regionResult });
          break;
          
        case 'startTranscript':
          activeTranscript = {
            id: Date.now().toString(),
            sessionId: request.sessionId || currentSession?.id,
            startTime: Date.now(),
            text: '',
            screenshots: []
          };
          isRecording = true;
          currentTranscriptText = '';
          console.log('Started recording, isRecording:', isRecording);
          sendResponse({ success: true, transcriptId: activeTranscript.id });
          break;
          
        case 'updateTranscript':
          if (isRecording && request.text) {
            currentTranscriptText = request.text;
            console.log('Updated transcript:', currentTranscriptText);
          }
          sendResponse({ success: true });
          break;
          
        case 'saveTranscript':
          if (activeTranscript) {
            activeTranscript.text = request.text;
            activeTranscript.endTime = Date.now();
            
            // Save to storage
            const { transcripts = {} } = await chrome.storage.local.get('transcripts');
            transcripts[activeTranscript.id] = activeTranscript;
            await chrome.storage.local.set({ transcripts });
            
            // Associate with recent screenshots
            const { screenshots = {} } = await chrome.storage.local.get('screenshots');
            const recentScreenshots = Object.values(screenshots)
              .filter(s => s.sessionId === activeTranscript.sessionId && 
                           s.timestamp >= activeTranscript.startTime)
              .map(s => s.id);
            
            activeTranscript.screenshots = recentScreenshots;
            transcripts[activeTranscript.id] = activeTranscript;
            await chrome.storage.local.set({ transcripts });
            
            sendResponse({ success: true, transcript: activeTranscript });
            activeTranscript = null;
            isRecording = false;
            currentTranscriptText = '';
          } else {
            sendResponse({ success: false, error: 'No active transcript' });
          }
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // Keep channel open for async response
});

async function checkStorageSpace() {
  return new Promise((resolve) => {
    chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
      // Chrome storage quota is 5MB (5,242,880 bytes)
      const quota = chrome.storage.local.QUOTA_BYTES || 5242880;
      const percentUsed = (bytesInUse / quota) * 100;
      console.log(`Storage used: ${bytesInUse} / ${quota} bytes (${percentUsed.toFixed(2)}%)`);
      resolve({
        bytesInUse,
        quota,
        percentUsed,
        spaceAvailable: quota - bytesInUse
      });
    });
  });
}

async function captureScreenshot(tab, type = 'full', region = null) {
  try {
    console.log('Capturing screenshot, tab:', tab, 'type:', type);
    
    // Check storage space before capturing
    const storage = await checkStorageSpace();
    if (storage.percentUsed > 90) {
      throw new Error(`Storage nearly full (${storage.percentUsed.toFixed(0)}%). Please delete old screenshots or export them first.`);
    }
    
    // Validate tab object
    if (!tab || !tab.windowId) {
      // If no valid tab, get the current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }
      tab = tabs[0];
      console.log('Using current active tab:', tab);
    }
    
    // Capture the screenshot with lower quality to save space
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 70  // Reduced from 95 to save storage
    });
    
    // Create screenshot object
    const screenshot = {
      id: Date.now().toString(),
      sessionId: currentSession?.id,
      imageData: dataUrl,
      timestamp: Date.now(),
      url: tab.url,
      title: tab.title,
      type: type,
      region: region,
      sequenceNumber: currentSession ? currentSession.screenshotCount + 1 : 1,
      transcript: isRecording ? currentTranscriptText : null
    };
    
    console.log('Creating screenshot with:', {
      isRecording,
      currentTranscriptText,
      transcript: screenshot.transcript
    });
    
    // Save to storage
    const { screenshots = {} } = await chrome.storage.local.get('screenshots');
    screenshots[screenshot.id] = screenshot;
    await chrome.storage.local.set({ screenshots });
    
    // Update session
    if (currentSession) {
      currentSession.screenshotCount++;
      await chrome.storage.local.set({ currentSession });
    }
    
    console.log('Screenshot saved:', screenshot.id);
    return screenshot;
  } catch (error) {
    console.error('Screenshot capture error:', error);
    throw error;
  }
}