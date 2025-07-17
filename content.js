console.log('Content script loaded');

let selectionOverlay = null;
let isSelecting = false;
let startX = 0;
let startY = 0;

// Listen for messages from extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startRegionSelection') {
    startRegionSelection();
    sendResponse({ success: true });
  }
  return true;
});

function startRegionSelection() {
  // Create overlay
  createOverlay();
  
  // Add event listeners
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);
}

function createOverlay() {
  // Remove existing overlay if any
  if (selectionOverlay) {
    selectionOverlay.remove();
  }
  
  selectionOverlay = document.createElement('div');
  selectionOverlay.className = 'screenshot-overlay';
  selectionOverlay.innerHTML = `
    <div class="screenshot-instructions">Click and drag to select a region</div>
    <div class="screenshot-selection"></div>
    <div class="screenshot-dimensions"></div>
  `;
  
  document.body.appendChild(selectionOverlay);
}

function handleMouseDown(e) {
  if (!selectionOverlay || e.target !== selectionOverlay) return;
  
  isSelecting = true;
  startX = e.clientX;
  startY = e.clientY;
  
  const selection = selectionOverlay.querySelector('.screenshot-selection');
  selection.style.left = startX + 'px';
  selection.style.top = startY + 'px';
  selection.style.width = '0px';
  selection.style.height = '0px';
  selection.style.display = 'block';
  
  // Hide instructions
  selectionOverlay.querySelector('.screenshot-instructions').style.display = 'none';
}

function handleMouseMove(e) {
  if (!isSelecting) return;
  
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  
  const selection = selectionOverlay.querySelector('.screenshot-selection');
  selection.style.left = left + 'px';
  selection.style.top = top + 'px';
  selection.style.width = width + 'px';
  selection.style.height = height + 'px';
  
  // Update dimensions display
  const dimensions = selectionOverlay.querySelector('.screenshot-dimensions');
  dimensions.textContent = `${width} × ${height}`;
  dimensions.style.display = 'block';
  dimensions.style.left = left + 'px';
  dimensions.style.top = (top - 30) + 'px';
}

function handleMouseUp(e) {
  if (!isSelecting) return;
  
  isSelecting = false;
  
  const selection = selectionOverlay.querySelector('.screenshot-selection');
  const rect = selection.getBoundingClientRect();
  
  if (rect.width > 10 && rect.height > 10) {
    // Valid selection made
    captureRegion({
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    });
  } else {
    // Too small, cancel
    cancelSelection();
  }
}

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    cancelSelection();
  }
}

async function captureRegion(region) {
  // Show capturing message
  const selection = selectionOverlay.querySelector('.screenshot-selection');
  selection.innerHTML = '<div class="capturing-message">Capturing...</div>';
  
  console.log('Sending region capture request:', region);
  
  try {
    // Send region info to background
    const response = await chrome.runtime.sendMessage({
      action: 'captureRegion',
      region: region
    });
    
    console.log('Capture response:', response);
    
    if (response && response.success) {
      // Show success
      selection.innerHTML = '<div class="success-message">✓ Captured!</div>';
      setTimeout(() => {
        cleanup();
      }, 1000);
    } else {
      throw new Error(response?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Capture error:', error);
    const errorMessage = error.message || 'Failed to capture';
    selection.innerHTML = `<div class="error-message">${errorMessage}</div>`;
    setTimeout(() => {
      cleanup();
    }, 2000);
  }
}

function cancelSelection() {
  cleanup();
}

function cleanup() {
  // Remove overlay
  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
  }
  
  // Remove event listeners
  document.removeEventListener('mousedown', handleMouseDown);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('keydown', handleKeyDown);
  
  isSelecting = false;
}