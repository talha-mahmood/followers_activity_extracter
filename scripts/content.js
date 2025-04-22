console.log("LinkedIn Insight Tracker: Content script loaded");

// Add subtle scroll behavior to simulate human browsing
function simulateHumanBehavior() {
  // Simulate human-like scrolling
  const scrollPoints = [300, 600, 900, 1200, 800, 400];
  let currentIndex = 0;

  const scrollInterval = setInterval(() => {
    window.scrollTo({
      top: scrollPoints[currentIndex],
      behavior: 'smooth'
    });
    
    currentIndex++;
    if (currentIndex >= scrollPoints.length) {
      clearInterval(scrollInterval);
    }
  }, 800 + Math.random() * 500); // Random delay between scrolls
  
  // Clear the interval after a timeout to ensure it stops
  setTimeout(() => {
    clearInterval(scrollInterval);
  }, 5000);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "extractData") {
    try {
      console.log("LinkedIn Insight Tracker: Starting data extraction");
      
      // Simulate human behavior before extracting
      simulateHumanBehavior();
      
      // Add slight delay before responding to simulate human data processing
      setTimeout(() => {
        const data = {
          followers: extractFollowersCount(),
          lastActivity: extractLastActivity(),
          profileName: extractProfileName(),
          profileDescription: extractProfileDescription()
        };
        
        console.log("LinkedIn Insight Tracker: Extracted data", data);
        sendResponse(data);
      }, 800 + Math.random() * 1200); // Random delay between 800ms and 2000ms
      
      return true; // Keep the message channel open for async response
    } catch (error) {
      console.error("LinkedIn Insight Tracker: Error extracting data", error);
      sendResponse({error: "Failed to extract data: " + error.message});
      return true;
    }
  }
  return true; // Keep the message channel open for async response
});

function extractFollowersCount() {
  console.log("LinkedIn Insight Tracker: Extracting followers count");
  
  // Try multiple selectors as LinkedIn's DOM structure might change over time
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

// Add new function to extract profile name
function extractProfileName() {
  console.log("LinkedIn Insight Tracker: Extracting profile name");
  
  // Try common LinkedIn profile name selectors
  const nameSelectors = [
    'h1.text-heading-xlarge',
    'h1.inline.t-24.v-align-middle.break-words',
    'h1.top-card-layout__title',
    'h1.text-heading-large',
    'h1.pv-top-card-section__name',
    'h1.artdeco-entity-lockup__title',
    'h1.profile-topcard-person-entity__name',
    'h1.MYDYEHKtjEkacpWodAYzOTrrbVonjEpJ',
    // Generic profile name selector as fallback
    'h1'
  ];
  
  for (const selector of nameSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`LinkedIn Insight Tracker: Trying selector ${selector}, found ${elements.length} elements`);
      
      for (const element of elements) {
        const text = element.textContent.trim();
        if (text && text.length > 1 && text.length < 100) {
          console.log(`LinkedIn Insight Tracker: Found profile name: "${text}"`);
          return text;
        }
      }
    } catch (e) {
      console.log(`LinkedIn Insight Tracker: Error with selector ${selector}:`, e);
    }
  }
  
  return "Not available";
}

// Add new function to extract profile description
function extractProfileDescription() {
  console.log("LinkedIn Insight Tracker: Extracting profile description");
  
  // Try common LinkedIn profile description selectors
  const descSelectors = [
    'div.text-body-medium.break-words',
    'div.pv-shared-text-with-see-more',
    'div.text-body-medium',
    'h2.mt1.t-18.t-black.t-normal.break-words',
    'span.text-body-small.inline.t-black--light.break-words',
    'div[data-generated-suggestion-target]',
    '.profile-topcard__summary-content span',
    '.pv-about-section .lt-line-clamp-v2',
    // Headline selectors
    '.pv-top-card-section__headline',
    '.profile-headline'
  ];
  
  for (const selector of descSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`LinkedIn Insight Tracker: Trying description selector ${selector}, found ${elements.length} elements`);
      
      for (const element of elements) {
        const text = element.textContent.trim();
        if (text && text.length > 10 && text.length < 500) {
          console.log(`LinkedIn Insight Tracker: Found profile description: "${text}"`);
          return text;
        }
      }
    } catch (e) {
      console.log(`LinkedIn Insight Tracker: Error with description selector ${selector}:`, e);
    }
  }
  
  return "Not available";
}
