# Troubleshooting Guide

## Common Issues and Solutions

### Voice Recording Issues

#### "Voice error: not-allowed"
**Problem**: Microphone permission denied
**Solution**:
1. Click the extension popup to open it
2. Look for the lock icon in the address bar
3. Click the lock icon and set "Microphone" to "Allow"
4. Reload the extension

#### Transcripts Not Attaching to Screenshots
**Problem**: Screenshots don't have voice annotations
**Debugging Steps**:
1. Open `chrome://extensions/`
2. Find the extension and click "service worker" link
3. Check console for these logs:
   - "Started recording, isRecording: true"
   - "Updated transcript: [your speech]"
   - "Creating screenshot with: {isRecording: true, transcript: ...}"

**Common Causes**:
- Not speaking before taking screenshot
- Speech recognition not picking up audio
- Taking screenshot after stopping recording

### Screenshot Issues

#### Region Selection Not Working
**Problem**: Can't drag to select region
**Solutions**:
- Ensure you're on a regular webpage (not Chrome pages like settings)
- Check if content script is loaded (console should show "Content script loaded")
- Try refreshing the page

#### "No active tab found" Error
**Problem**: Extension can't find the current tab
**Solution**:
- Ensure you have a webpage open
- Click on the webpage before using the extension
- Don't use on Chrome system pages

### Dashboard Issues

#### Screenshots Not Appearing
**Problem**: Dashboard shows "No screenshots yet"
**Solutions**:
1. Check if screenshots are saved:
   - Open DevTools on dashboard (F12)
   - Run: `chrome.storage.local.get('screenshots', console.log)`
2. Ensure you have an active session
3. Try refreshing the dashboard

#### Export Not Working
**Problem**: Export buttons don't download files
**Solution**:
- Check browser download settings
- Ensure popup blockers aren't interfering
- Check console for errors

## Debugging Tools

### View Storage Contents
```javascript
// In any extension page console:
chrome.storage.local.get(null, (data) => {
  console.log('All storage:', data);
});
```

### Clear All Data
```javascript
// Warning: This deletes all screenshots!
chrome.storage.local.clear(() => {
  console.log('Storage cleared');
});
```

### Check Current State
```javascript
// In background service worker console:
console.log({
  isRecording,
  currentTranscriptText,
  currentSession,
  activeTranscript
});
```

## Performance Tips

1. **Large Screenshots**: Full page captures of long pages may be slow
2. **Voice Recognition**: Works best in quiet environments
3. **Storage Limits**: Chrome has storage limits, export and clear old sessions
4. **Memory Usage**: Many screenshots can use significant memory

## Getting Help

If issues persist:
1. Check the console for error messages
2. Verify all permissions are granted
3. Try disabling and re-enabling the extension
4. Reload the extension from chrome://extensions/