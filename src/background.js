// Background Service Worker for Chrome Extension
// Helps maintain extension state and prevent unexpected stops

// Keep the service worker alive
let keepAliveInterval;

function startKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  // Ping every 20 seconds to keep service worker alive
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      // This keeps the service worker active
    });
  }, 20000);
}

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  startKeepAlive();

  if (details.reason === 'install') {
    // Fresh install - initialize with empty data
    console.log('Fresh installation - initializing storage');
    chrome.storage.local.get(['backgroundVideos', 'savedLinks'], (result) => {
      const updates = {};
      if (!result.backgroundVideos) {
        updates.backgroundVideos = [];
      }
      if (!result.savedLinks) {
        updates.savedLinks = [];
      }
      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates, () => {
          console.log('Initial storage set:', updates);
        });
      }
    });
  } else if (details.reason === 'update') {
    // Extension updated - preserve existing data
    console.log('Extension updated from', details.previousVersion, 'to', chrome.runtime.getManifest().version);

    // Verify data integrity after update
    chrome.storage.local.get(['backgroundVideos', 'savedLinks'], (result) => {
      console.log('Storage after update:', {
        backgroundVideos: result.backgroundVideos?.length || 0,
        savedLinks: result.savedLinks?.length || 0
      });

      // Ensure data structure exists even if empty
      const updates = {};
      if (result.backgroundVideos === undefined) {
        updates.backgroundVideos = [];
        console.warn('backgroundVideos was undefined after update, initializing to []');
      }
      if (result.savedLinks === undefined) {
        updates.savedLinks = [];
        console.warn('savedLinks was undefined after update, initializing to []');
      }

      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates, () => {
          console.log('Fixed missing storage keys after update');
        });
      }
    });
  }
});

// Restart keep-alive on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
  startKeepAlive();
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);

  if (request.type === 'keepAlive') {
    sendResponse({ status: 'alive' });
  } else if (request.type === 'getStorage') {
    chrome.storage.local.get(request.keys, (result) => {
      sendResponse({ data: result });
    });
    return true; // Keep channel open for async response
  } else if (request.type === 'setStorage') {
    chrome.storage.local.set(request.data, () => {
      sendResponse({ status: 'success' });
    });
    return true;
  }

  return false;
});

// Monitor storage changes and log them
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('Storage changed in', namespace, ':', changes);
});

// Handle errors gracefully
self.addEventListener('error', (event) => {
  console.error('Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Start keep-alive immediately
startKeepAlive();
