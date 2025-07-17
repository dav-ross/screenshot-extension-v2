# Screenshot & Voice Annotation Chrome Extension

A Chrome extension for capturing screenshots with voice annotations, designed for AI test generation and documentation workflows.

## Features

- **Screenshot Capture**: Full page and region selection screenshots
- **Voice Annotation**: Record voice descriptions while capturing screenshots
- **Session Management**: Organize screenshots into sessions
- **Dashboard View**: View, manage, and export all captured screenshots
- **Export Options**: Export to HTML, JSON, or Markdown formats
- **Real-time Transcription**: Voice recordings are transcribed in real-time and attached to screenshots

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `screenshot-extension-v2` directory
5. Grant microphone permissions when prompted

## Usage

### Basic Screenshot Capture

1. Click the extension icon to open the popup
2. Create a new session (or use existing)
3. Click "Capture Full Page" or "Capture Region"
4. For region capture, click and drag to select area

### Voice Annotation Workflow

1. Click the microphone button to start recording
2. Speak your description of what you're about to capture
3. While still recording, take screenshots
4. The transcript will be automatically attached to each screenshot
5. Click stop recording when done

### Viewing and Exporting

1. Click "View All" to open the dashboard
2. Filter by session if needed
3. Export screenshots with transcripts to:
   - HTML (for documentation)
   - JSON (for API integration)
   - Markdown (for repositories)

## Architecture

### File Structure

```
screenshot-extension-v2/
├── manifest.json          # Extension configuration
├── background.js          # Service worker handling core logic
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── content.js            # Content script for region selection
├── content.css           # Styles for region selection overlay
├── dashboard.html        # Dashboard for viewing screenshots
└── dashboard.js          # Dashboard functionality
```

### Key Components

#### Background Service Worker (`background.js`)
- Manages extension state (sessions, recordings)
- Handles screenshot capture via Chrome APIs
- Stores screenshots with attached transcripts
- Message passing hub between components

Key variables:
- `currentSession`: Active session object
- `isRecording`: Boolean flag for voice recording state
- `currentTranscriptText`: Current transcript text
- `activeTranscript`: Current transcript session

#### Popup (`popup.js` + `popup.html`)
- Main user interface
- Voice recording using Web Speech API
- Screenshot trigger buttons
- Session management
- Real-time transcript display

Key features:
- `SpeechRecognition` API for voice capture
- Sends transcript updates to background
- Displays current session info

#### Content Script (`content.js`)
- Injected into web pages for region selection
- Creates overlay for visual selection
- Handles mouse events for drag selection
- Sends region coordinates to background

#### Dashboard (`dashboard.js` + `dashboard.html`)
- Displays all captured screenshots
- Session filtering
- Export functionality
- Full-size image viewing

### Data Flow

1. **Voice Recording Flow**:
   ```
   User speaks → Popup (SpeechRecognition) → updateTranscript → Background → 
   Stored in currentTranscriptText
   ```

2. **Screenshot with Transcript**:
   ```
   User captures → Background checks isRecording → 
   Attaches currentTranscriptText → Saves to storage
   ```

3. **Storage Structure**:
   ```javascript
   {
     screenshots: {
       "id": {
         id: "timestamp",
         sessionId: "session-id",
         imageData: "data:image/png;base64,...",
         transcript: "Voice annotation text",
         timestamp: 1234567890,
         url: "page-url",
         title: "page-title",
         type: "full|region",
         sequenceNumber: 1
       }
     },
     currentSession: {
       id: "session-id",
       name: "Session Name",
       created: 1234567890,
       screenshotCount: 5
     }
   }
   ```

### Message Protocol

Messages between components use Chrome's runtime messaging:

```javascript
// Start recording
{ action: 'startTranscript', sessionId: 'xxx' }

// Update transcript
{ action: 'updateTranscript', text: 'current transcript' }

// Capture screenshot
{ action: 'captureScreenshot', tab: tabObject }

// Region capture
{ action: 'captureRegion', region: {x, y, width, height} }
```

## Development

### Adding New Features

1. **New Message Types**: Add handler in `background.js` switch statement
2. **New UI Elements**: Update `popup.html` and corresponding handlers in `popup.js`
3. **Storage Changes**: Update data structures in background and dashboard

### Debugging

1. View background logs: Chrome Extensions page → Service worker link
2. View popup logs: Right-click popup → Inspect
3. View content script logs: Regular DevTools on web page

### Known Issues

- Transcripts may not attach if speech recognition fails
- Region selection doesn't work on Chrome system pages
- Voice recording requires explicit microphone permissions

## Future Enhancements

- [ ] Edit transcripts after capture
- [ ] Batch operations on screenshots
- [ ] Cloud storage integration
- [ ] Advanced export templates
- [ ] Keyboard shortcuts
- [ ] Multiple transcript languages

## License

MIT License - Feel free to modify and distribute