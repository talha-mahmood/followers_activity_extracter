document.addEventListener('DOMContentLoaded', function() {
  const linkedinUrlInput = document.getElementById('linkedin-url');
  const clearBtn = document.getElementById('clear-btn');
  const extractBtn = document.getElementById('extract-btn');
  const loadingSection = document.getElementById('loading');
  const resultsSection = document.getElementById('results');
  const errorSection = document.getElementById('error');
  const followersCount = document.getElementById('followers-count');
  const lastActivity = document.getElementById('last-activity');
  const retryBtn = document.getElementById('retry-btn');
  const errorMessage = document.getElementById('error-message');
  const helpLink = document.getElementById('help-link');

  const exportCsvBtn = document.getElementById('export-csv');
  const exportJsonBtn = document.getElementById('export-json');
  const exportExcelBtn = document.getElementById('export-excel');

  const profilesContainer = document.getElementById('profiles-container');
  let profilesData = [];
  let processingQueue = [];
  let isProcessing = false;
  let stopExtraction = false;

  const saveSettingsBtn = document.createElement('button');
  saveSettingsBtn.id = 'save-settings-btn';
  saveSettingsBtn.className = 'save-settings-btn';
  saveSettingsBtn.innerHTML = '<span class="material-icons-round">save</span><span>Save URLs</span>';
  
  const urlInputContainer = document.querySelector('.url-input-container');
  urlInputContainer.appendChild(saveSettingsBtn);

  const stopBtn = document.createElement('button');
  stopBtn.id = 'stop-btn';
  stopBtn.className = 'stop-btn hidden';
  stopBtn.innerHTML = '<span class="material-icons-round">stop</span><span>Stop Extraction</span>';
  urlInputContainer.appendChild(stopBtn);

  const refreshHint = document.querySelector('.refresh-hint');
  refreshHint.textContent = `Updated ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

  function saveUrlsToStorage() {
    const urls = linkedinUrlInput.value.trim();
    if (urls) {
      chrome.storage.local.set({ 'savedUrls': urls }, function() {
        showSaveSuccess();
      });
    }
  }
  
  function loadSavedUrls() {
    chrome.storage.local.get('savedUrls', function(data) {
      if (data.savedUrls) {
        linkedinUrlInput.value = data.savedUrls;
        clearBtn.style.display = 'flex';
      }
    });
  }
  
  function showSaveSuccess() {
    const originalText = saveSettingsBtn.innerHTML;
    saveSettingsBtn.innerHTML = '<span class="material-icons-round">check</span><span>Saved!</span>';
    saveSettingsBtn.classList.add('success-action');
    
    setTimeout(() => {
      saveSettingsBtn.innerHTML = originalText;
      saveSettingsBtn.classList.remove('success-action');
    }, 2000);
  }
  
  saveSettingsBtn.addEventListener('click', saveUrlsToStorage);

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    if (currentUrl.includes('linkedin.com/in/')) {
      linkedinUrlInput.value = currentUrl;
      clearBtn.style.display = 'flex';
    } else {
      loadSavedUrls();
    }
  });

  linkedinUrlInput.addEventListener('input', function() {
    clearBtn.style.display = this.value ? 'flex' : 'none';
  });

  clearBtn.style.display = linkedinUrlInput.value ? 'flex' : 'none';

  clearBtn.addEventListener('click', function() {
    linkedinUrlInput.value = '';
    clearBtn.style.display = 'none';
    linkedinUrlInput.focus();
  });

  extractBtn.addEventListener('click', function() {
    const urlsText = linkedinUrlInput.value.trim();
    
    if (!urlsText) {
      showError('Please enter at least one LinkedIn profile URL');
      return;
    }
    
    const urls = urlsText.split('\n')
      .map(url => url.trim())
      .filter(url => url && url.includes('linkedin.com/in/'));
    
    if (urls.length === 0) {
      showError('No valid LinkedIn profile URLs found');
      return;
    }
    
    profilesData = [];
    profilesContainer.innerHTML = '';
    
    extractBtn.classList.add('extracting');
    extractBtn.innerHTML = '<span class="btn-text">Extracting...</span>';
    
    stopBtn.classList.remove('hidden');
    
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
    
    resultsSection.classList.remove('hidden');
    errorSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTabId = tabs[0].id;
      
      chrome.runtime.sendMessage({
        action: "startExtraction",
        urls: urls,
        tabId: currentTabId
      }, function(response) {
        console.log("Extraction started in background:", response);
        isProcessing = true;
        
        urls.forEach((url, index) => {
          addProfileCard({
            profile_url: url,
            profile_name: getProfileNameFromUrl(url),
            status: 'pending'
          }, index);
        });
      });
    });
  });

  stopBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: "stopExtraction" }, function(response) {
      console.log("Extraction stopped:", response);
      finishBatchProcessing();
    });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "extractionProgress") {
      console.log("Received progress update:", message);
      
      updateProgress(message.completed, message.total);
      
      chrome.runtime.sendMessage({ action: "getProfilesData" }, function(response) {
        if (response && response.profilesData) {
          profilesData = response.profilesData;
          
          profilesData.forEach((data, index) => {
            updateProfileCard(index, {
              ...data,
              status: 'success'
            });
          });
        }
      });
    }
    else if (message.action === "extractionComplete") {
      console.log("Extraction complete notification received");
      
      if (message.profilesData) {
        profilesData = message.profilesData;
      }
      
      finishBatchProcessing();
    }
    return true;
  });

  chrome.runtime.sendMessage({ action: "getExtractionState" }, function(state) {
    if (state && state.isRunning) {
      console.log("Extraction already running, updating UI");
      
      extractBtn.classList.add('extracting');
      extractBtn.innerHTML = '<span class="btn-text">Extracting...</span>';
      stopBtn.classList.remove('hidden');
      
      chrome.runtime.sendMessage({ action: "getProfilesData" }, function(response) {
        if (response && response.profilesData) {
          profilesData = response.profilesData;
          
          profilesContainer.innerHTML = '';
          
          const progressContainer = document.createElement('div');
          progressContainer.className = 'progress-container';
          progressContainer.innerHTML = `
            <div class="progress-label">
              <span>Processing profiles...</span>
              <span id="progress-text">${state.completedProfiles}/${state.totalProfiles}</span>
            </div>
            <div class="progress-bar">
              <div id="progress-fill" class="progress-fill" style="width: ${(state.completedProfiles / state.totalProfiles) * 100}%"></div>
            </div>
          `;
          profilesContainer.appendChild(progressContainer);
          
          resultsSection.classList.remove('hidden');
          errorSection.classList.add('hidden');
          loadingSection.classList.add('hidden');
          
          profilesData.forEach((data, index) => {
            addProfileCard({
              ...data,
              status: 'success'
            }, index);
          });
          
          for (let i = profilesData.length; i < state.totalProfiles; i++) {
            const url = i < state.processingQueue.length 
              ? state.processingQueue[i - profilesData.length]
              : 'Unknown Profile';
              
            addProfileCard({
              profile_url: url,
              profile_name: getProfileNameFromUrl(url),
              status: 'pending'
            }, i);
          }
        }
      });
    }
  });

  function showHumanActionMessage(message) {
    const progressText = document.getElementById('progress-text');
    const container = document.querySelector('.progress-label');
    
    let actionMsg = document.getElementById('human-action-msg');
    if (!actionMsg) {
      actionMsg = document.createElement('div');
      actionMsg.id = 'human-action-msg';
      actionMsg.className = 'human-action-msg';
      container.appendChild(actionMsg);
    }
    
    typeMessage(actionMsg, message);
  }
  
  function typeMessage(element, message) {
    let i = 0;
    element.textContent = "";
    
    if (window.typingInterval) clearInterval(window.typingInterval);
    
    window.typingInterval = setInterval(() => {
      if (i < message.length) {
        element.textContent += message.charAt(i);
        i++;
      } else {
        clearInterval(window.typingInterval);
      }
    }, 50 + Math.random() * 30);
  }
  
  function getProfileNameFromUrl(url) {
    return url.split('/in/')[1]?.split('/')[0] || 'Unknown Profile';
  }
  
  function updateProgress(current, total) {
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');
    
    if (progressText && progressFill) {
      progressText.textContent = `${current}/${total}`;
      progressFill.style.width = `${(current / total) * 100}%`;
    }
  }
  
  function finishBatchProcessing() {
    isProcessing = false;
    
    extractBtn.classList.remove('extracting', 'hidden');
    extractBtn.innerHTML = '<span class="btn-text">Extract Data</span><span class="material-icons-round">arrow_forward</span>';
    
    stopBtn.classList.add('hidden');
    
    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
      progressContainer.remove();
    }
    
    refreshHint.textContent = `Updated ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    
    const statusMessage = document.createElement('div');
    statusMessage.className = 'status-message extraction-complete';
    statusMessage.innerHTML = `<span class="material-icons-round">check_circle</span> Extraction complete. Processed ${profilesData.length} profiles.`;
    profilesContainer.prepend(statusMessage);
    
    setTimeout(() => {
      statusMessage.classList.add('fade-out');
      setTimeout(() => {
        if (statusMessage.parentNode) {
          statusMessage.remove();
        }
      }, 500);
    }, 5000);
  }
  
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
    
    const displayName = profileData.display_name || profileData.profile_name;
    
    card.innerHTML = `
      <div class="profile-header">
        <div>
          <div class="profile-name">${displayName}</div>
          <div class="profile-url">${profileData.profile_url}</div>
        </div>
        <span class="profile-status ${statusClass}">${statusText}</span>
      </div>
      <div class="profile-description">${profileData.description || ''}</div>
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
    
    const displayName = profileData.display_name || profileData.profile_name;
    
    card.innerHTML = `
      <div class="profile-header">
        <div>
          <div class="profile-name">${displayName}</div>
          <div class="profile-url">${profileData.profile_url}</div>
        </div>
        <span class="profile-status ${statusClass}">${statusText}</span>
      </div>
      <div class="profile-description">${profileData.description || ''}</div>
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

  retryBtn.addEventListener('click', function() {
    extractBtn.click();
  });

  helpLink.addEventListener('click', function(e) {
    e.preventDefault();
    alert('LinkedIn Insight Tracker Help\n\nThis extension extracts follower counts and last activity dates from LinkedIn profiles.\n\nTo use:\n1. Enter one or more LinkedIn profile URLs (one per line)\n2. Click "Extract Data"\n3. View and export the results in CSV, JSON, or Excel format');
  });

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

  document.querySelectorAll('.metric-card').forEach(card => {
    card.addEventListener('mouseover', function() {
      this.style.transform = 'translateY(-4px)';
    });
    
    card.addEventListener('mouseout', function() {
      this.style.transform = 'translateY(-2px)';
    });
  });

  function exportData(format) {
    console.log(`Starting export in ${format} format for ${profilesData.length} profiles`);
    
    if (profilesData.length === 0) {
      alert('No profile data to export');
      return;
    }
    
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const filename = profilesData.length === 1
      ? `linkedin-insights-${profilesData[0].profile_name}-${timestamp}`
      : `linkedin-insights-multiple-profiles-${timestamp}`;
    
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
    const toast = document.createElement('div');
    toast.className = 'export-toast';
    toast.innerHTML = `<span class="material-icons-round">check_circle</span> Exported as ${format}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  loadSavedUrls();
});
