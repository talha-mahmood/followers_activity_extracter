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

  extractBtn.addEventListener('click', function() {
    const url = linkedinUrlInput.value.trim();
    
    if (!url || !url.includes('linkedin.com/in/')) {
      showError('Please enter a valid LinkedIn profile URL');
      return;
    }
    
    // Add extraction animation
    extractBtn.classList.add('extracting');
    extractBtn.innerHTML = '<span class="btn-text">Extracting...</span>';
    
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
      
      // Get profile name from URL
      const profileName = linkedinUrlInput.value.split('/in/')[1]?.split('/')[0] || 'Unknown Profile';
      
      savedProfiles.push({
        url: linkedinUrlInput.value,
        name: profileName,
        followers: followersCount.textContent,
        lastActivity: lastActivity.textContent,
        savedAt: new Date().toISOString()
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

  // Function to export data in various formats
  function exportData(format) {
    console.log(`Starting export in ${format} format`);
    
    // Get profile name from URL
    const profileUrl = linkedinUrlInput.value;
    const profileName = profileUrl.split('/in/')[1]?.split('/')[0] || 'unknown-profile';
    
    // Create a timestamp
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Build dataset
    const data = [{
      profile_url: profileUrl,
      profile_name: profileName,
      followers: followersCount.textContent,
      last_activity: lastActivity.textContent,
      extracted_at: now.toISOString()
    }];
    
    console.log('Export data prepared:', data);
    
    // Generate filename
    const filename = `linkedin-insights-${profileName}-${timestamp}`;
    
    // Use the simple export functions
    try {
      console.log(`Exporting as ${format}...`);
      
      switch(format) {
        case 'csv':
          SimpleExport.toCsv(data, `${filename}.csv`);
          break;
        case 'json':
          SimpleExport.toJson(data, `${filename}.json`);
          break;
        case 'excel':
          SimpleExport.toExcel(data, `${filename}.xls`);
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
