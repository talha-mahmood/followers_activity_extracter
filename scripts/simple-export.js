/**
 * Simple direct export functions for LinkedIn Insight Tracker
 * Supports exporting multiple profiles at once
 */

// Export to CSV
function exportToCsv(data, filename) {
  console.log("Starting CSV export", data);
  
  // Ensure data is an array
  if (!Array.isArray(data)) {
    data = [data];
  }
  
  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  let csvContent = headers.join(',') + '\n';
  
  // Add data rows
  data.forEach(item => {
    const row = headers.map(header => {
      // Handle values with commas by wrapping in quotes
      const value = item[header] || '';
      return `"${value.toString().replace(/"/g, '""')}"`;
    });
    csvContent += row.join(',') + '\n';
  });
  
  console.log("CSV content created", csvContent);
  
  // Create and download file
  downloadFile(csvContent, filename, 'text/csv');
}

// Export to JSON
function exportToJson(data, filename) {
  console.log("Starting JSON export", data);
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
}

// Export to Excel (simple HTML table)
function exportToExcel(data, filename) {
  console.log("Starting Excel export", data);
  
  // Ensure data is an array
  if (!Array.isArray(data)) {
    data = [data];
  }
  
  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create HTML table
  let htmlContent = '<html><head><meta charset="UTF-8"></head><body>';
  htmlContent += '<table border="1">';
  
  // Add header row
  htmlContent += '<tr>';
  headers.forEach(header => {
    htmlContent += `<th>${header}</th>`;
  });
  htmlContent += '</tr>';
  
  // Add data rows
  data.forEach(item => {
    htmlContent += '<tr>';
    headers.forEach(header => {
      htmlContent += `<td>${item[header] || ''}</td>`;
    });
    htmlContent += '</tr>';
  });
  
  htmlContent += '</table></body></html>';
  
  // Create and download file
  downloadFile(htmlContent, filename, 'application/vnd.ms-excel');
}

// Common download function
function downloadFile(content, filename, mimeType) {
  console.log(`Downloading file: ${filename} (${mimeType})`);
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  
  console.log("Triggering download click");
  a.click();
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Download cleanup complete");
  }, 100);
}

// Make functions available globally
window.SimpleExport = {
  toCsv: exportToCsv,
  toJson: exportToJson,
  toExcel: exportToExcel
};

console.log("Simple Export utilities loaded and ready");
