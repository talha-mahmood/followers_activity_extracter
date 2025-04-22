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
