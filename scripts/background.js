// Simple background script to handle any extension-level events
chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Insight Tracker installed successfully');
  // Initialize state on installation
  saveStateToStorage(); 
});

// Store the extraction state - initialize potentially from storage
let extractionState = {
  isRunning: false,
  processingQueue: [],
  profilesData: [],
  currentTabId: null,
  currentUrl: null,
  totalProfiles: 0,
  completedProfiles: 0
};

// Function to save the current state to storage
function saveStateToStorage() {
  chrome.storage.local.set({ extractionState: extractionState }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving state:", chrome.runtime.lastError);
    } else {
      console.log("Extraction state saved to storage.");
    }
  });
}

// Function to load state from storage
function loadStateFromStorage(callback) {
  chrome.storage.local.get('extractionState', (result) => {
    if (chrome.runtime.lastError) {
      console.error("Error loading state:", chrome.runtime.lastError);
      if (callback) callback(false); // Indicate failure
    } else if (result.extractionState) {
      console.log("Extraction state loaded from storage:", result.extractionState);
      // Merge loaded state carefully, especially isRunning
      extractionState = { 
        ...result.extractionState, 
        isRunning: false, // Always assume not running on load
        currentTabId: null // Reset tab ID on load
      }; 
      if (callback) callback(true); // Indicate success
    } else {
       console.log("No previous state found in storage.");
       if (callback) callback(false); // Indicate no data found
    }
  });
}

// Load state when the background script starts
loadStateFromStorage();

// Enable the extension on LinkedIn profile pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('linkedin.com/in/')) {
    chrome.action.enable(tabId);
  }
});

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message.action);

  if (message.action === "startExtraction") {
    // Reset relevant parts of state before starting a new extraction
    extractionState.isRunning = true;
    extractionState.processingQueue = [...message.urls];
    extractionState.profilesData = []; // Clear previous results for a new run
    extractionState.currentTabId = message.tabId;
    extractionState.totalProfiles = message.urls.length;
    extractionState.completedProfiles = 0;
    
    saveStateToStorage(); // Save initial state of new extraction
    
    // Start the extraction process
    processNextProfileBackground();
    sendResponse({ status: "started" });
    return true;
  }
  
  else if (message.action === "stopExtraction") {
    extractionState.isRunning = false;
    extractionState.processingQueue = []; 
    saveStateToStorage(); // Save stopped state
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
    
    extractionState.isRunning = false; // Ensure isRunning is false
    saveStateToStorage(); // Save final state on completion/stop

    // Notify popup that extraction is complete
    chrome.runtime.sendMessage({
      action: "extractionComplete",
      profilesData: extractionState.profilesData
    });
    
    // Reset extraction state (optional, could keep data until next run)
    return;
  }
  
  const url = extractionState.processingQueue[0]; // Keep reference to url
  console.log("Processing next profile in background:", url);
  
  // Navigate to the profile URL in the current tab
  chrome.tabs.update(extractionState.currentTabId, { url: url }, (tab) => {
    // *** ADDED: Error handling for navigation itself ***
    if (chrome.runtime.lastError) {
        console.error(`Error navigating to ${url}:`, chrome.runtime.lastError.message);
        // Handle navigation error: Mark profile as error, save state, and continue
        extractionState.processingQueue.shift(); // Remove from queue
        extractionState.completedProfiles++;
        extractionState.profilesData.push({
            profile_url: url,
            profile_name: getProfileNameFromUrl(url),
            display_name: 'Navigation Error',
            description: 'Could not load profile page',
            followers: 'Error',
            last_activity: 'Error',
            extracted_at: new Date().toISOString(),
            error: `Navigation failed: ${chrome.runtime.lastError.message}`
        });
        saveStateToStorage(); // Save state after handling navigation error
        // Broadcast progress
        chrome.runtime.sendMessage({
            action: "extractionProgress",
            completed: extractionState.completedProfiles,
            total: extractionState.totalProfiles,
            currentProfile: url
        });
        // Continue with the next profile after a short delay
        setTimeout(processNextProfileBackground, 1000); // Shorter delay after navigation error
        return; // Stop further processing for this URL
    }
    // *** END ADDED ***

    // Listen for page load completion
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Wait a bit for LinkedIn to fully load
        setTimeout(() => {
          // Extract data from the profile
          chrome.tabs.sendMessage(tabId, { action: "extractData" }, (response) => {
            // Ensure queue is shifted and completed count incremented regardless of response
            // Check if the URL we just processed is still at the front of the queue before shifting
            if (extractionState.processingQueue.length > 0 && extractionState.processingQueue[0] === url) {
                extractionState.processingQueue.shift();
            } else if (extractionState.processingQueue.length > 0) {
                 console.warn("Queue mismatch detected after sendMessage response for:", url);
                 // Attempt to find and remove the URL if it exists elsewhere (less likely but safer)
                 const indexToRemove = extractionState.processingQueue.indexOf(url);
                 if (indexToRemove > -1) {
                     extractionState.processingQueue.splice(indexToRemove, 1);
                 }
            }
            extractionState.completedProfiles++; // Increment completed count

            if (chrome.runtime.lastError || !response || response.error) {
              // Error during content script execution or communication
              console.error(`Error extracting data from ${url}:`, chrome.runtime.lastError?.message || response?.error);
              extractionState.profilesData.push({
                profile_url: url,
                profile_name: getProfileNameFromUrl(url),
                display_name: 'Extraction Error',
                description: 'Failed to get data from page',
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
            
            // Save state after processing each profile (success or error)
            saveStateToStorage(); 

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
