// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "extractData") {
    try {
      console.log("LinkedIn Insight Tracker: Starting data extraction");
      
      const data = {
        followers: extractFollowersCount(),
        lastActivity: extractLastActivity()
      };
      
      console.log("LinkedIn Insight Tracker: Extracted data", data);
      sendResponse(data);
    } catch (error) {
      console.error("LinkedIn Insight Tracker: Error extracting data", error);
      sendResponse({error: "Failed to extract data: " + error.message});
    }
  }
  return true; // Keep the message channel open for async response
});

function extractFollowersCount() {
  console.log("LinkedIn Insight Tracker: Extracting followers count");
  
  // Updated selectors for modern LinkedIn UI
  const followersSelectors = [
    // New LinkedIn UI selectors
    '.artdeco-entity-lockup__subtitle span',
    '.pvs-header__subtitle span.t-black--light span',
    '.pvs-header__subtitle .pvs-entity__subtitle-item span',
    '.pv-top-card--list-bullet li .pv-top-card__extra-info span',
    '.pv-top-card--list .pv-top-card__followers-count',
    // Text containing followers
    'span:contains("followers")',
    // Other potential selectors
    'a[data-control-name="followers"] span',
    'a[href*="followers"] span',
    // Activity section followers
    '.pv-recent-activity-section__follower-count span'
  ];
  
  // Manual DOM traversal as a fallback
  try {
    // Look for text that contains 'followers'
    const allSpans = document.querySelectorAll('span');
    for (const span of allSpans) {
      const text = span.textContent.trim();
      if (text.includes('follower')) {
        console.log("LinkedIn Insight Tracker: Found follower text:", text);
        const match = text.match(/([\d,]+)\s+follower/i);
        if (match) {
          return match[1];
        }
      }
    }
    
    // Try with querySelector for each selector
    for (const selector of followersSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`LinkedIn Insight Tracker: Trying selector ${selector}, found ${elements.length} elements`);
        
        for (const element of elements) {
          const text = element.textContent.trim();
          console.log(`LinkedIn Insight Tracker: Element text: "${text}"`);
          
          if (text.includes('follower')) {
            const match = text.match(/([\d,]+)/);
            if (match) {
              return match[1];
            }
          }
        }
      } catch (e) {
        console.log(`LinkedIn Insight Tracker: Error with selector ${selector}:`, e);
        // Continue to next selector
      }
    }
  } catch (e) {
    console.error("LinkedIn Insight Tracker: Error in follower extraction:", e);
  }
  
  return "Not available";
}

function extractLastActivity() {
  console.log("LinkedIn Insight Tracker: Extracting last activity");
  
  try {
    // Check recent activity section first
    const activityElements = document.querySelectorAll('.feed-shared-update-v2, .update-components-actor, .feed-shared-actor');
    
    if (activityElements.length > 0) {
      console.log(`LinkedIn Insight Tracker: Found ${activityElements.length} activity elements`);
      
      // Look for time elements or timestamps
      const timeSelectors = [
        'time', 
        '.feed-shared-actor__sub-description', 
        '.update-components-actor__sub-description',
        'span.visually-hidden',
        'span[aria-hidden="true"]',
        'span.t-black--light'
      ];
      
      for (const selector of timeSelectors) {
        const timeElements = document.querySelectorAll(selector);
        console.log(`LinkedIn Insight Tracker: Found ${timeElements.length} time elements with selector ${selector}`);
        
        for (const timeElement of timeElements) {
          const timeText = timeElement.textContent.trim();
          console.log(`LinkedIn Insight Tracker: Time text: "${timeText}"`);
          
          // Check for date patterns
          if (timeText.match(/\d+\s*(minute|hour|day|week|month|year)/i) || 
              timeText.match(/yesterday|today/i)) {
            return calculateDaysSince(timeText);
          }
        }
      }
    }
    
    // Fallback: Look for any timestamps in the page
    const allSpans = document.querySelectorAll('span');
    for (const span of allSpans) {
      const text = span.textContent.trim();
      if (text.match(/\d+\s*(minute|hour|day|week|month|year)s?\s+ago/i)) {
        console.log(`LinkedIn Insight Tracker: Found time text in span: "${text}"`);
        return calculateDaysSince(text);
      }
    }
    
    // Look for actual date values
    const dateRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i;
    for (const span of allSpans) {
      const text = span.textContent.trim();
      if (dateRegex.test(text)) {
        console.log(`LinkedIn Insight Tracker: Found date text: "${text}"`);
        return calculateDaysSince(text);
      }
    }
  } catch (e) {
    console.error("LinkedIn Insight Tracker: Error in activity extraction:", e);
  }
  
  return "No recent activity found";
}

function calculateDaysSince(timeText) {
  console.log(`LinkedIn Insight Tracker: Calculating days since: "${timeText}"`);
  timeText = timeText.toLowerCase().trim();
  
  // Handle recent activity
  if (timeText.includes('now') || timeText.includes('minute') || timeText.includes('hour')) {
    return "Today";
  }
  
  if (timeText.includes('yesterday')) {
    return "1 day ago";
  }
  
  if (timeText.includes('today')) {
    return "Today";
  }
  
  // Extract the number and time unit
  const match = timeText.match(/(\d+|a|an)\s*(day|week|month|year)/i);
  
  if (match) {
    let amount = match[1];
    const unit = match[2].toLowerCase();
    
    // Convert text number to numeric
    if (amount === 'a' || amount === 'an') {
      amount = 1;
    } else {
      amount = parseInt(amount, 10);
    }
    
    return `${amount} ${unit}${amount !== 1 ? 's' : ''} ago`;
  }
  
  // Try to parse actual dates (e.g., "July 15, 2023")
  try {
    const date = new Date(timeText);
    if (!isNaN(date.getTime())) {
      const daysDiff = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
      return `${daysDiff} days ago`;
    }
  } catch (e) {
    console.log("LinkedIn Insight Tracker: Error parsing date:", e);
  }
  
  return timeText; // Return the original text if we couldn't parse it
}

// Execute immediately on page load to check if extraction works
console.log("LinkedIn Insight Tracker: Content script loaded");
setTimeout(() => {
  try {
    const followers = extractFollowersCount();
    const activity = extractLastActivity();
    console.log("LinkedIn Insight Tracker: Initial extraction test:", { followers, activity });
  } catch (e) {
    console.error("LinkedIn Insight Tracker: Initial extraction test failed:", e);
  }
}, 2000);
