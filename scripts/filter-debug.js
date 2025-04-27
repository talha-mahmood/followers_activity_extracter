/**
 * Filter debugging utilities for LinkedIn Insight Tracker
 * Helps diagnose issues with activity filtering
 */

class FilterDebug {
  /**
   * Test parsing of activity texts
   * @param {Array} activityTexts - List of activity text strings to test
   * @returns {Object} Parsed results
   */
  static testActivityParsing(activityTexts) {
    if (!Array.isArray(activityTexts)) {
      activityTexts = [activityTexts];
    }
    
    const results = {};
    
    activityTexts.forEach(text => {
      let days = null;
      let error = null;
      
      try {
        days = this.parseActivityToDays(text);
      } catch (e) {
        error = e.message;
      }
      
      results[text] = {
        daysAgo: days,
        error: error,
        wouldPassFilter: {
          '3 days': days !== null && days <= 3,
          '1 week': days !== null && days <= 7,
          '1 month': days !== null && days <= 30
        }
      };
    });
    
    console.table(results);
    return results;
  }
  
  /**
   * Parse activity text to days
   * @param {String} text - Activity text to parse
   * @returns {Number|null} Number of days ago or null if couldn't parse
   */
  static parseActivityToDays(text) {
    if (!text || text === 'Not available' || text === '-' || text === 'No recent activity found') {
      return null;
    }
    
    const lowerText = text.toLowerCase().trim();
    
    // Handle "today"
    if (lowerText === 'today') {
      return 0;
    }
    
    // Handle "yesterday" or "1 day ago"
    if (lowerText === 'yesterday' || lowerText === '1 day ago') {
      return 1;
    }
    
    // Handle "X days/weeks/months/years ago"
    const match = lowerText.match(/(\d+)\s+(day|week|month|year)s?\s+ago/i);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      
      // Convert to days
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
    
    // Try to parse actual dates
    try {
      if (lowerText.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i)) {
        const date = new Date(text);
        if (!isNaN(date.getTime())) {
          return Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
        }
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
    
    return null;
  }
  
  /**
   * Test filtering with a specific data set
   * @param {Array} profiles - Profile data to test
   * @param {Object} filters - Filter settings to apply
   */
  static testFiltering(profiles, filters) {
    if (!Array.isArray(profiles)) {
      console.error('Profiles must be an array');
      return;
    }
    
    const filtered = profiles.filter(profile => {
      let passesFollowerFilter = true;
      let passesActivityFilter = true;
      
      // Check followers filter
      if (filters.minFollowers) {
        const followers = parseInt(profile.followers?.replace(/,/g, ''), 10);
        if (isNaN(followers) || followers < filters.minFollowers) {
          passesFollowerFilter = false;
        }
      }
      
      // Check activity filter
      if (filters.minActivity) {
        const activityDays = this.parseActivityToDays(profile.last_activity);
        
        // Convert min activity to days
        let maxAllowedDays;
        if (filters.minActivityUnit === 'days') {
          maxAllowedDays = filters.minActivity;
        } else if (filters.minActivityUnit === 'weeks') {
          maxAllowedDays = filters.minActivity * 7;
        } else if (filters.minActivityUnit === 'months') {
          maxAllowedDays = filters.minActivity * 30;
        }
        
        if (activityDays === null || activityDays > maxAllowedDays) {
          passesActivityFilter = false;
        }
      }
      
      return passesFollowerFilter && passesActivityFilter;
    });
    
    console.log(`Filtered ${filtered.length} profiles out of ${profiles.length}`);
    console.log('Included profiles:', filtered.map(p => p.display_name || p.profile_name));
    console.log('Excluded profiles:', profiles
      .filter(p => !filtered.includes(p))
      .map(p => p.display_name || p.profile_name));
    
    return filtered;
  }
  
  /**
   * Run a comprehensive test suite on the current data
   * @param {Array} profilesData - Current profiles data 
   */
  static runComprehensiveTest(profilesData) {
    console.log('='.repeat(50));
    console.log('COMPREHENSIVE FILTER TEST');
    console.log('='.repeat(50));
    
    if (!profilesData || !profilesData.length) {
      console.error('No profile data available for testing');
      return;
    }
    
    console.log(`Testing with ${profilesData.length} profiles`);
    
    // Test 1: Parse all activity texts
    console.log('\n1. ACTIVITY TEXT PARSING');
    console.log('-'.repeat(50));
    
    const activityTexts = profilesData.map(p => p.last_activity);
    this.testActivityParsing(activityTexts);
    
    // Test 2: Filter with different settings
    console.log('\n2. FILTER TESTS');
    console.log('-'.repeat(50));
    
    const filterSettings = [
      { label: '3 days', minActivity: 3, minActivityUnit: 'days', minFollowers: null },
      { label: '1 week', minActivity: 1, minActivityUnit: 'weeks', minFollowers: null },
      { label: '1 month', minActivity: 1, minActivityUnit: 'months', minFollowers: null },
      { label: '1000+ followers', minActivity: null, minActivityUnit: null, minFollowers: 1000 },
      { label: 'Combined', minActivity: 3, minActivityUnit: 'days', minFollowers: 1000 }
    ];
    
    filterSettings.forEach(settings => {
      console.log(`\nTest: ${settings.label}`);
      const results = this.testFiltering(profilesData, settings);
      console.log(`Results: ${results.length} profiles passed the filter`);
    });
    
    console.log('\nTEST COMPLETE');
    console.log('='.repeat(50));
  }
  
  /**
   * Test minimum followers filter specifically
   * @param {Array} profilesData - Current profiles data
   */
  static testFollowersFilter(profilesData) {
    console.log('='.repeat(50));
    console.log('FOLLOWERS FILTER TEST');
    console.log('='.repeat(50));
    
    if (!profilesData || !profilesData.length) {
      console.error('No profile data available for testing');
      return;
    }

    // Display all followers counts for reference
    console.log('\nAll profiles followers counts:');
    profilesData.forEach(profile => {
      const name = profile.display_name || profile.profile_name;
      const followersStr = profile.followers || '0';
      const followers = parseInt(followersStr.replace(/,/g, ''), 10);
      console.log(`${name}: ${followersStr} → ${followers} (numeric)`);
    });
    
    // Test different follower thresholds
    const thresholds = [100, 500, 1000, 2000, 5000];
    
    thresholds.forEach(threshold => {
      let passed = 0;
      console.log(`\nTesting min followers: ${threshold}`);
      
      profilesData.forEach(profile => {
        const name = profile.display_name || profile.profile_name;
        const followersStr = profile.followers || '0';
        const followers = parseInt(followersStr.replace(/,/g, ''), 10);
        
        const passes = !isNaN(followers) && followers >= threshold;
        if (passes) passed++;
        
        console.log(`- ${name}: ${followersStr} (${followers}) - ${passes ? 'PASS' : 'FAIL'}`);
      });
      
      console.log(`Results for ${threshold} followers: ${passed} of ${profilesData.length} passed`);
    });
    
    console.log('\nTEST COMPLETE');
  }
  
  /**
   * Test export functionality
   */
  static testExport(profilesData, activeFilters, filteredData) {
    console.log('='.repeat(50));
    console.log('EXPORT FUNCTIONALITY TEST');
    console.log('='.repeat(50));
    
    if (!profilesData || !profilesData.length) {
      console.error('No profile data available for testing');
      return;
    }
    
    console.log(`Total profiles: ${profilesData.length}`);
    console.log(`Filtered profiles: ${filteredData.length}`);
    console.log('Active filters:', activeFilters);
    
    const hasActiveFilters = activeFilters.minFollowers !== null || activeFilters.minActivity !== null;
    const expectedExportData = hasActiveFilters && filteredData.length > 0 ? filteredData : profilesData;
    
    console.log(`\nExport would include ${expectedExportData.length} profiles`);
    console.log(`Profiles that would be exported:`);
    expectedExportData.forEach(profile => {
      console.log(`- ${profile.display_name || profile.profile_name}`);
    });
    
    console.log('\nEXPORT TEST COMPLETE');
  }
  
  /**
   * Test filter directly on the live popup
   */
  static applyTestFilters() {
    if (typeof window !== 'undefined' && window.applyDataFilters && window.activeFilters) {
      // Save current filters
      const savedFilters = {...window.activeFilters};
      
      // Test cases
      const testFilters = [
        { minFollowers: null, minActivity: 3, minActivityUnit: 'days' },
        { minFollowers: null, minActivity: 7, minActivityUnit: 'days' },
        { minFollowers: null, minActivity: 1, minActivityUnit: 'weeks' },
        { minFollowers: null, minActivity: 1, minActivityUnit: 'months' }
      ];
      
      console.log('LIVE FILTER TESTS');
      console.log('-'.repeat(50));
      
      testFilters.forEach(filter => {
        console.log(`\nTesting filter: ${filter.minActivity} ${filter.minActivityUnit}`);
        
        // Apply test filter
        window.activeFilters = {...filter};
        window.applyDataFilters();
        
        // Log results
        console.log(`Filter applied, check UI for results`);
        
        // Pause for visual inspection
        console.log('Waiting 3 seconds before next test...');
      });
      
      // Restore original filters
      window.activeFilters = savedFilters;
      window.applyDataFilters();
      console.log('\nTests complete, restored original filters');
    } else {
      console.error('Cannot access required functions for live testing. Run this from the popup context.');
    }
  }
  
  /**
   * Debug utility to fix the activity filter in live mode
   */
  static fixActivityFilter() {
    console.log('Attempting to fix activity filter...');
    
    if (typeof window === 'undefined' || !window.profilesData) {
      console.error('Cannot access required data. Run this from the popup context.');
      return;
    }
    
    // Replace the popup's parseActivityDays function with our corrected version
    if (typeof window.parseActivityDays === 'function') {
      console.log('Replacing parseActivityDays function');
      window.parseActivityDays = this.parseActivityToDays.bind(this);
    }
    
    // Apply fix to getActivityDays if it exists
    if (typeof window.getActivityDays === 'function') {
      console.log('Replacing getActivityDays function');
      window.getActivityDays = this.parseActivityToDays.bind(this);
    }
    
    console.log('Filter functions patched. Try applying filters again.');
  }
}

// Make available for console debugging
window.FilterDebug = FilterDebug;

// Add a diagnostic function for filters and exports
window.testFollowersFilter = function() {
  if (window.profilesData) {
    FilterDebug.testFollowersFilter(window.profilesData);
  } else {
    console.error('No profile data available');
  }
};

window.testExportFunctionality = function() {
  if (window.profilesData && window.activeFilters) {
    FilterDebug.testExport(window.profilesData, window.activeFilters, window.filteredData || []);
  } else {
    console.error('Required data not available');
  }
};

// Export for module use if needed
if (typeof module !== 'undefined') {
  module.exports = FilterDebug;
}

// Auto-execute test if the script is loaded in the correct context
if (typeof window !== 'undefined' && window.profilesData) {
  console.log('FilterDebug loaded. Run FilterDebug.runComprehensiveTest(profilesData) for testing.');
}
