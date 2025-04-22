document.addEventListener('DOMContentLoaded', function() {
  const linkedinUrlInput = document.getElementById('linkedin-url');
  const extractBtn = document.getElementById('extract-btn');
  const loadingSection = document.getElementById('loading');
  const resultsSection = document.getElementById('results');
  const errorSection = document.getElementById('error');
  const followersCount = document.getElementById('followers-count');
  const lastActivity = document.getElementById('last-activity');
  const copyBtn = document.getElementById('copy-btn');
  const errorMessage = document.getElementById('error-message');

  // Check if we're on a LinkedIn profile page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    if (currentUrl.includes('linkedin.com/in/')) {
      linkedinUrlInput.value = currentUrl;
    }
  });

  extractBtn.addEventListener('click', function() {
    const url = linkedinUrlInput.value.trim();
    
    if (!url || !url.includes('linkedin.com/in/')) {
      showError('Please enter a valid LinkedIn profile URL');
      return;
    }
    
    showLoading();
    
    // Check if we need to navigate to the URL first
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = tabs[0].url;
      
      if (currentUrl === url || (currentUrl.includes('linkedin.com/in/') && url.includes('linkedin.com/in/'))) {
        // We're already on a LinkedIn profile page, extract data
        extractData(tabs[0].id);
      } else {
        // Navigate to the URL first, then extract data
        chrome.tabs.update({url: url}, function(tab) {
          // Wait for page to load before extracting data
          chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === tab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              setTimeout(() => extractData(tab.id), 2500); // Give the page more time to fully load
            }
          });
        });
      }
    });
  });

  copyBtn.addEventListener('click', function() {
    const resultText = `LinkedIn Insight Tracker Results:\n` +
                      `Followers: ${followersCount.textContent}\n` + 
                      `Last Activity: ${lastActivity.textContent}`;
    
    navigator.clipboard.writeText(resultText).then(function() {
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '<span class="material-icons">check</span> Copied!';
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
      }, 2000);
    });
  });

  function extractData(tabId) {
    chrome.tabs.sendMessage(tabId, {action: "extractData"}, function(response) {
      hideLoading();
      
      if (chrome.runtime.lastError) {
        console.error("LinkedIn Insight Tracker: Runtime error", chrome.runtime.lastError);
        showError('Content script not loaded. Try refreshing the page.');
        return;
      }
      
      if (!response) {
        showError('No response from content script. Try refreshing the page.');
        return;
      }
      
      if (response.error) {
        showError(response.error);
        return;
      }
      
      followersCount.textContent = response.followers || 'Not available';
      lastActivity.textContent = response.lastActivity || 'Not available';
      showResults();
    });
  }

  function showLoading() {
    resultsSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
  }

  function hideLoading() {
    loadingSection.classList.add('hidden');
  }

  function showResults() {
    resultsSection.classList.remove('hidden');
    errorSection.classList.add('hidden');
  }

  function showError(message) {
    resultsSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    errorSection.classList.remove('hidden');
    errorMessage.textContent = message;
  }
});
