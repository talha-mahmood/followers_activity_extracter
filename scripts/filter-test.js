/**
 * Test utility for LinkedIn Insight Tracker filtering
 * This file can be run manually to test filtering logic
 */

// Test data with various activity patterns
const testProfiles = [
  {
    display_name: "Profile 1",
    followers: "1,500",
    last_activity: "today"
  },
  {
    display_name: "Profile 2",
    followers: "800",
    last_activity: "yesterday"
  },
  {
    display_name: "Profile 3",
    followers: "2,000",
    last_activity: "1 day ago"
  },
  {
    display_name: "Profile 4",
    followers: "5,000",
    last_activity: "2 days ago"
  },
  {
    display_name: "Profile 5",
    followers: "3,200",
    last_activity: "1 week ago"
  },
  {
    display_name: "Profile 6",
    followers: "1,050",
    last_activity: "2 weeks ago"
  },
  {
    display_name: "Profile 7",
    followers: "950",
    last_activity: "1 month ago"
  },
  {
    display_name: "Profile 8",
    followers: "10,000",
    last_activity: "3 months ago"
  }
];

// Function to parse activity text to days
function parseActivityDays(text) {
  if (!text || typeof text !== 'string') return null;
  
  const trimmedText = text.trim().toLowerCase();
  console.log(`Parsing activity text: "${trimmedText}"`);
  
  // Special cases
  if (trimmedText === 'today') return 0;
  if (trimmedText === 'yesterday') return 1;
  if (trimmedText === '1 day ago') return 1;
  
  // Pattern: X days/weeks/months/years ago
  const timePattern = /^(\d+)\s+(day|week|month|year)s?\s+ago$/i;
  const match = trimmedText.match(timePattern);
  
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    
    if (unit === 'day') {
      return value;
    } else if (unit === 'week') {
      return value * 7;
    } else if (unit === 'month') {
      return value * 30;
    } else if (unit === 'year') {
      return value * 365;
    }
  }
  
  // Try to parse calendar dates
  if (/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(trimmedText)) {
    try {
      const date = new Date(text);
      if (!isNaN(date.getTime())) {
        return Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
  }
  
  return null;
}

// Filter test function
function testFilter(profiles, filter) {
  console.log(`\nTesting filter: ${filter.label}`);
  console.log('-'.repeat(50));
  
  const filtered = profiles.filter(profile => {
    const activityDays = parseActivityDays(profile.last_activity);
    
    // Calculate max allowed days
    let maxAllowedDays;
    if (filter.unit === 'days') {
      maxAllowedDays = filter.value;
    } else if (filter.unit === 'weeks') {
      maxAllowedDays = filter.value * 7;
    } else if (filter.unit === 'months') {
      maxAllowedDays = filter.value * 30;
    }
    
    const passes = activityDays !== null && activityDays <= maxAllowedDays;
    console.log(`${profile.display_name}: Activity "${profile.last_activity}" (${activityDays} days) - ${passes ? 'INCLUDED' : 'EXCLUDED'}`);
    
    return passes;
  });
  
  console.log(`\nResults for "${filter.label}": ${filtered.length} of ${profiles.length} profiles passed`);
  console.log('Included profiles:');
  filtered.forEach(p => console.log(`- ${p.display_name}`));
  
  return filtered;
}

// Run tests for different filter settings
function runTests() {
  console.log('FILTER TEST SUITE');
  console.log('='.repeat(50));
  
  const filters = [
    { value: 3, unit: 'days', label: '3 days' },
    { value: 7, unit: 'days', label: '7 days' },
    { value: 1, unit: 'weeks', label: '1 week' },
    { value: 1, unit: 'months', label: '1 month' }
  ];
  
  filters.forEach(filter => {
    testFilter(testProfiles, filter);
  });
  
  console.log('\nTest Complete');
}

// Automatically run the tests if this file is executed directly
runTests();

// Make function available globally for console use
if (typeof window !== 'undefined') {
  window.runFilterTests = runTests;
  console.log('Filter test utility loaded. Run window.runFilterTests() to test filtering logic.');
}
