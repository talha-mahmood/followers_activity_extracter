document.addEventListener('DOMContentLoaded', function() {
  const linkedinUrlInput = document.getElementById('linkedin-url');
  const clearBtn = document.getElementById('clear-btn');
  const extractBtn = document.getElementById('extract-btn');
  const loadingSection = document.getElementById('loading');
  const resultsSection = document.getElementById('results');
  const errorSection = document.getElementById('error');
  const followersCount = document.getElementById('followers-count');
  const lastActivity = document.getElementById('last-activity');
  const copyBtn = document.getElementById('copy-btn');
  const saveBtn = document.getElementById('save-btn');
  const retryBtn = document.getElementById('retry-btn');
  const errorMessage = document.getElementById('error-message');
  const helpLink = document.getElementById('help-link');
  const settingsLink = document.getElementById('settings-link');

  // Update the export button variables to match the IDs in the HTML
  const exportCsvBtn = document.getElementById('export-csv');
  const exportJsonBtn = document.getElementById('export-json');
  const exportExcelBtn = document.getElementById('export-excel');

  // Add new variables for batch processing
  const profilesContainer = document.getElementById('profiles-container');
  let profilesData = []; // Will store data for all processed profiles
  let processingQueue = []; // Queue of URLs to process
  let isProcessing = false; // Flag to prevent multiple batch processes

  // Set current date in the refresh hint
  const refreshHint = document.querySelector('.refresh-hint');
  refreshHint.textContent = `Updated ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

  // Check if we're on a LinkedIn profile page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    if (currentUrl.includes('linkedin.com/in/')) {
      linkedinUrlInput.value = currentUrl;
      // If we're already on a LinkedIn profile, auto-extract data
      setTimeout(() => extractBtn.click(), 300);
    }
  });

  // Show/hide clear button based on input content
  linkedinUrlInput.addEventListener('input', function() {
    clearBtn.style.display = this.value ? 'flex' : 'none';
  });

  // Initially hide clear button if input is empty
  clearBtn.style.display = linkedinUrlInput.value ? 'flex' : 'none';

  // Clear input when clear button is clicked
  clearBtn.addEventListener('click', function() {
    linkedinUrlInput.value = '';
    clearBtn.style.display = 'none';
    linkedinUrlInput.focus();
  });

  // Modify the extractBtn click handler for batch processing
  extractBtn.addEventListener('click', function() {
    const urlsText = linkedinUrlInput.value.trim();
    
    if (!urlsText) {
      showError('Please enter at least one LinkedIn profile URL');
      return;
    }
    
    // Parse multiple URLs (one per line)
    const urls = urlsText.split('\n')
      .map(url => url.trim())
      .filter(url => url && url.includes('linkedin.com/in/'));
    
    if (urls.length === 0) {
      showError('No valid LinkedIn profile URLs found');
      return;
    }
    
    // Reset data from previous run
    profilesData = [];
    processingQueue = [...urls]; // Create a copy of the URLs array
    
    // Show loading state
    extractBtn.classList.add('extracting');
    extractBtn.innerHTML = '<span class="btn-text">Extracting...</span>';
    
    // Clear previous results and prepare container
    profilesContainer.innerHTML = '';
    
    // Create progress elements
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    progressContainer.innerHTML = `
      <div class="progress-label">
        <span>Processing profiles...</span>
        <span id="progress-text">0/${urls.length}</span>
      </div>
      <div class="progress-bar">
        <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
      </div>
    `;
    profilesContainer.appendChild(progressContainer);
    
    // Show results container with progress bar
    resultsSection.classList.remove('hidden');
    errorSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    
    // Start batch processing
    isProcessing = true;
    processNextProfile();
  });
  
  // Function to process profiles one by one
  function processNextProfile() {
    if (processingQueue.length === 0) {
      // All profiles processed
      finishBatchProcessing();
      return;
    }
    
    const url = processingQueue[0];
    const profileIndex = profilesData.length;
    const totalProfiles = profilesData.length + processingQueue.length;
    
    // Update progress indicator
    updateProgress(profileIndex, totalProfiles);
    
    // Create a placeholder card for this profile
    addProfileCard({
      profile_url: url,
      profile_name: getProfileNameFromUrl(url),
      status: 'pending'
    }, profileIndex);
    
    // Process this profile
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTabId = tabs[0].id;
      
      // Navigate to the profile URL
      chrome.tabs.update({url: url}, function(tab) {
        // Wait for page to load before extracting data
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            
            // Wait a bit more for LinkedIn to fully load
            setTimeout(() => {
              // Extract data from this profile
              chrome.tabs.sendMessage(tabId, {action: "extractData"}, function(response) {
                // Remove this URL from the queue
                processingQueue.shift();
                
                if (chrome.runtime.lastError || !response || response.error) {
                  // Error with this profile
                  profilesData.push({
                    profile_url: url,
                    profile_name: getProfileNameFromUrl(url),
                    followers: 'Error',
                    last_activity: 'Error',
                    extracted_at: new Date().toISOString(),
                    error: chrome.runtime.lastError?.message || response?.error || 'Failed to extract data'
                  });
                  
                  // Update the profile card to show error
                  updateProfileCard(profileIndex, {
                    profile_url: url,
                    profile_name: getProfileNameFromUrl(url),
                    followers: 'Error',
                    last_activity: 'Error',
                    status: 'error'
                  });
                } else {
                  // Success with this profile
                  const profileData = {
                    profile_url: url,
                    profile_name: getProfileNameFromUrl(url),
                    followers: response.followers || 'Not available',
                    last_activity: response.lastActivity || 'Not available',
                    extracted_at: new Date().toISOString()
                  };
                  
                  profilesData.push(profileData);
                  
                  // Update the profile card with the extracted data
                  updateProfileCard(profileIndex, {
                    ...profileData,
                    status: 'success'
                  });
                }
                
                // Process the next profile in the queue
                processNextProfile();
              });
            }, 2500);
          }
        });
      });
    });
  }
  
  // Helper function to get profile name from URL
  function getProfileNameFromUrl(url) {
    return url.split('/in/')[1]?.split('/')[0] || 'Unknown Profile';
  }
  
  // Function to update progress bar
  function updateProgress(current, total) {
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');
    
    if (progressText && progressFill) {
      progressText.textContent = `${current}/${total}`;
      progressFill.style.width = `${(current / total) * 100}%`;
    }
  }
  
  // Function to finalize batch processing
  function finishBatchProcessing() {
    isProcessing = false;
    
    // Reset extract button state
    extractBtn.classList.remove('extracting');
    extractBtn.innerHTML = '<span class="btn-text">Extract Data</span><span class="material-icons-round">arrow_forward</span>';
    
    // Remove progress bar
    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
      progressContainer.remove();
    }
    
    // Update the refresh time
    refreshHint.textContent = `Updated ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  }
  
  // Function to add a profile card to the results
  function addProfileCard(profileData, index) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.id = `profile-card-${index}`;
    
    let statusClass = 'status-pending';
    let statusText = 'Pending';
    
    if (profileData.status === 'success') {
      statusClass = 'status-success';
      statusText = 'Success';
    } else if (profileData.status === 'error') {
      statusClass = 'status-error';
      statusText = 'Error';
    }
    
    card.innerHTML = `
      <div class="profile-header">
        <div>
          <div class="profile-name">${profileData.profile_name}</div>
          <div class="profile-url">${profileData.profile_url}</div>
        </div>
        <span class="profile-status ${statusClass}">${statusText}</span>
      </div>
      <div class="profile-metrics">
        <div class="profile-metric">
          <div class="metric-label">Followers</div>
          <div class="metric-value">${profileData.followers || '-'}</div>
        </div>
        <div class="profile-metric">
          <div class="metric-label">Last Activity</div>
          <div class="metric-value">${profileData.last_activity || '-'}</div>
        </div>
      </div>
    `;
    
    profilesContainer.appendChild(card);
  }
  
  // Function to update an existing profile card
  function updateProfileCard(index, profileData) {
    const card = document.getElementById(`profile-card-${index}`);
    if (!card) return;
    
    let statusClass = 'status-pending';
    let statusText = 'Pending';
    
    if (profileData.status === 'success') {
      statusClass = 'status-success';
      statusText = 'Success';
    } else if (profileData.status === 'error') {
      statusClass = 'status-error';
      statusText = 'Error';
    }
    
    card.innerHTML = `
      <div class="profile-header">
        <div>
          <div class="profile-name">${profileData.profile_name}</div>
          <div class="profile-url">${profileData.profile_url}</div>
        </div>
        <span class="profile-status ${statusClass}">${statusText}</span>
      </div>
      <div class="profile-metrics">
        <div class="profile-metric">
          <div class="metric-label">Followers</div>
          <div class="metric-value">${profileData.followers || '-'}</div>
        </div>
        <div class="profile-metric">
          <div class="metric-label">Last Activity</div>
          <div class="metric-value">${profileData.last_activity || '-'}</div>
        </div>
      </div>
    `;
  }

  copyBtn.addEventListener('click', function() {
    let resultText = `LinkedIn Insight Tracker Results:\n\n`;
    
    profilesData.forEach((profile, index) => {
      resultText += `Profile ${index + 1}: ${profile.profile_name}\n`;
      resultText += `URL: ${profile.profile_url}\n`;
      resultText += `Followers: ${profile.followers}\n`;
      resultText += `Last Activity: ${profile.last_activity}\n`;
      resultText += `Extracted: ${new Date(profile.extracted_at).toLocaleString()}\n\n`;
    });
    
    navigator.clipboard.writeText(resultText).then(function() {
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '<span class="material-icons-round">check</span><span>Copied!</span>';
      
      // Add success animation
      copyBtn.classList.add('success-action');
      
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.classList.remove('success-action');
      }, 2000);
    });
  });

  saveBtn.addEventListener('click', function() {
    // Animation for save button
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="material-icons-round">check</span><span>Saved!</span>';
    
    // Add success animation
    saveBtn.classList.add('success-action');
    
    // Store the profile data in chrome.storage
    chrome.storage.local.get('savedProfiles', function(data) {
      const savedProfiles = data.savedProfiles || [];
      
      // Add all current profiles to saved profiles
      profilesData.forEach(profile => {
        savedProfiles.push(profile);
      });
      
      chrome.storage.local.set({savedProfiles: savedProfiles}, function() {
        setTimeout(() => {
          saveBtn.innerHTML = originalText;
          saveBtn.classList.remove('success-action');
        }, 2000);
      });
    });
  });

  retryBtn.addEventListener('click', function() {
    extractBtn.click();
  });

  helpLink.addEventListener('click', function(e) {
    e.preventDefault();
    // Show a help modal or redirect to help page
    alert('LinkedIn Insight Tracker Help\n\nThis extension extracts follower counts and last activity dates from LinkedIn profiles.\n\nTo use:\n1. Navigate to a LinkedIn profile\n2. Click "Extract Data"\n3. View and save the results');
  });

  settingsLink.addEventListener('click', function(e) {
    e.preventDefault();
    // Show settings modal
    alert('Settings feature coming in the next update!');
  });

  // Export button event listeners - make sure these are properly connected
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', function() {
      console.log('CSV export button clicked');
      exportData('csv');
    });
  } else {
    console.error('CSV export button not found in the DOM');
  }
  
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', function() {
      console.log('JSON export button clicked');
      exportData('json');
    });
  } else {
    console.error('JSON export button not found in the DOM');
  }
  
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', function() {
      console.log('Excel export button clicked');
      exportData('excel');
    });
  } else {
    console.error('Excel export button not found in the DOM');
  }

  function extractData(tabId) {
    chrome.tabs.sendMessage(tabId, {action: "extractData"}, function(response) {
      hideLoading();
      
      // Reset extract button state
      extractBtn.classList.remove('extracting');
      extractBtn.innerHTML = '<span class="btn-text">Extract Data</span><span class="material-icons-round">arrow_forward</span>';
      
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
      
      // Update the refresh time
      refreshHint.textContent = `Updated ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
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
    // Add entrance animation
    const metricCards = document.querySelectorAll('.metric-card');
    metricCards.forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(10px)';
      setTimeout(() => {
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 100 * (index + 1));
    });
  }

  function showError(message) {
    resultsSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    errorSection.classList.remove('hidden');
    errorMessage.textContent = message;
  }

  // Add some subtle animations for better UX
  document.querySelectorAll('.metric-card').forEach(card => {
    card.addEventListener('mouseover', function() {
      this.style.transform = 'translateY(-4px)';
    });
    
    card.addEventListener('mouseout', function() {
      this.style.transform = 'translateY(-2px)';
    });
  });

  // Update the export function for multiple profiles
  function exportData(format) {
    console.log(`Starting export in ${format} format for ${profilesData.length} profiles`);
    
    if (profilesData.length === 0) {
      alert('No profile data to export');
      return;
    }
    
    // Create a timestamp for the filename
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Generate filename based on number of profiles
    const filename = profilesData.length === 1
      ? `linkedin-insights-${profilesData[0].profile_name}-${timestamp}`
      : `linkedin-insights-multiple-profiles-${timestamp}`;
    
    // Use the simple export functions
    try {
      console.log(`Exporting ${profilesData.length} profiles as ${format}...`);
      
      switch(format) {
        case 'csv':
          SimpleExport.toCsv(profilesData, `${filename}.csv`);
          break;
        case 'json':
          SimpleExport.toJson(profilesData, `${filename}.json`);
          break;
        case 'excel':
          SimpleExport.toExcel(profilesData, `${filename}.xls`);
          break;
      }
      
      console.log('Export successful');
      showExportSuccess(format);
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
    }
  }
  
  function showExportSuccess(format) {
    // Create and show a temporary success toast
    const toast = document.createElement('div');
    toast.className = 'export-toast';
    toast.innerHTML = `<span class="material-icons-round">check_circle</span> Exported as ${format}`;
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

});
