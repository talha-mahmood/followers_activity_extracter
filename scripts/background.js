// Simple background script to handle any extension-level events
chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Insight Tracker installed successfully');
});

// Enable the extension on LinkedIn profile pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('linkedin.com/in/')) {
    chrome.action.enable(tabId);
  }
});

// Store the extraction state
let extractionState = {
  isRunning: false,
  processingQueue: [],
  profilesData: [],
  currentTabId: null,
  currentUrl: null,
  totalProfiles: 0,
  completedProfiles: 0
};

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message.action);

  if (message.action === "startExtraction") {
    // Save extraction parameters
    extractionState = {
      isRunning: true,
      processingQueue: [...message.urls],
      profilesData: [],
      currentTabId: message.tabId,
      totalProfiles: message.urls.length,
      completedProfiles: 0
    };
    
    // Start the extraction process
    processNextProfileBackground();
    sendResponse({ status: "started" });
    return true;
  }
  
  else if (message.action === "stopExtraction") {
    extractionState.isRunning = false;
    extractionState.processingQueue = [];
    sendResponse({ status: "stopped" });
    return true;
  }
  
  else if (message.action === "getExtractionState") {
    sendResponse(extractionState);
    return true;
  }
  
  else if (message.action === "getProfilesData") {
    sendResponse({ profilesData: extractionState.profilesData });
    return true;
  }
});

// Function to process profiles in the background
function processNextProfileBackground() {
  if (!extractionState.isRunning || extractionState.processingQueue.length === 0) {
    console.log("Background extraction complete or stopped");
    
    // Notify popup that extraction is complete
    chrome.runtime.sendMessage({
      action: "extractionComplete",
      profilesData: extractionState.profilesData
    });
    
    // Reset extraction state
    extractionState.isRunning = false;
    return;
  }
  
  const url = extractionState.processingQueue[0];
  console.log("Processing next profile in background:", url);
  
  // Navigate to the profile URL in the current tab
  chrome.tabs.update(extractionState.currentTabId, { url: url }, (tab) => {
    // Listen for page load completion
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Wait a bit for LinkedIn to fully load
        setTimeout(() => {
          // Extract data from the profile
          chrome.tabs.sendMessage(tabId, { action: "extractData" }, (response) => {
            // Remove this URL from the queue
            extractionState.processingQueue.shift();
            extractionState.completedProfiles++;
            
            if (chrome.runtime.lastError || !response || response.error) {
              // Error with this profile
              extractionState.profilesData.push({
                profile_url: url,
                profile_name: getProfileNameFromUrl(url),
                display_name: 'Not available',
                description: 'Not available',
                followers: 'Error',
                last_activity: 'Error',
                extracted_at: new Date().toISOString(),
                error: chrome.runtime.lastError?.message || response?.error || 'Failed to extract data'
              });
            } else {
              // Success with this profile
              extractionState.profilesData.push({
                profile_url: url,
                profile_name: getProfileNameFromUrl(url),
                display_name: response.profileName || 'Not available',
                description: response.profileDescription || 'Not available',
                followers: response.followers || 'Not available',
                last_activity: response.lastActivity || 'Not available',
                extracted_at: new Date().toISOString()
              });
            }
            
            // Broadcast progress update
            chrome.runtime.sendMessage({
              action: "extractionProgress",
              completed: extractionState.completedProfiles,
              total: extractionState.totalProfiles,
              currentProfile: url
            });
            
            // Add a human-like delay before processing the next profile
            setTimeout(() => {
              processNextProfileBackground();
            }, 2000 + Math.floor(Math.random() * 3000));
          });
        }, 3000 + Math.floor(Math.random() * 4000));
      }
    });
  });
}

// Helper function to get profile name from URL
function getProfileNameFromUrl(url) {
  return url.split('/in/')[1]?.split('/')[0] || 'Unknown Profile';
}
