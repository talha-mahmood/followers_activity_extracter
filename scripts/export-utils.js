/**
 * Export utilities for LinkedIn Insight Tracker
 * Provides functionality to export data in various formats
 */

class DataExporter {
  /**
   * Export data as CSV file
   * @param {Object} data - The data to export
   * @param {String} filename - The filename without extension
   */
  static exportCSV(data, filename = 'linkedin-insights') {
    // Make sure data is an array
    if (!Array.isArray(data)) {
      data = [data];
    }
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(field => 
          `"${(row[field] || '').toString().replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this._triggerDownload(blob, `${filename}.csv`);
    
    console.log('CSV Export completed');
    return true;
  }
  
  /**
   * Export data as JSON file
   * @param {Object} data - The data to export
   * @param {String} filename - The filename without extension
   */
  static exportJSON(data, filename = 'linkedin-insights') {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    this._triggerDownload(blob, `${filename}.json`);
    
    console.log('JSON Export completed');
    return true;
  }
  
  /**
   * Export data as Excel-compatible XML file
   * @param {Object} data - The data to export
   * @param {String} filename - The filename without extension
   */
  static exportExcel(data, filename = 'linkedin-insights') {
    // Make sure data is an array
    if (!Array.isArray(data)) {
      data = [data];
    }
    
    // Create XML that Excel can open
    const headers = Object.keys(data[0]);
    
    // XML header and Excel worksheet template
    let xmlContent = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
    xmlContent += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ';
    xmlContent += 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xmlContent += '<Worksheet ss:Name="LinkedIn Insights"><Table>';
    
    // Add headers row
    xmlContent += '<Row>';
    headers.forEach(header => {
      xmlContent += `<Cell><Data ss:Type="String">${header}</Data></Cell>`;
    });
    xmlContent += '</Row>';
    
    // Add data rows
    data.forEach(row => {
      xmlContent += '<Row>';
      headers.forEach(field => {
        const value = (row[field] || '').toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
        xmlContent += `<Cell><Data ss:Type="String">${value}</Data></Cell>`;
      });
      xmlContent += '</Row>';
    });
    
    // Close tags
    xmlContent += '</Table></Worksheet></Workbook>';
    
    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
    this._triggerDownload(blob, `${filename}.xls`);
    
    console.log('Excel Export completed');
    return true;
  }
  
  /**
   * Trigger browser download
   * @private
   */
  static _triggerDownload(blob, filename) {
    console.log(`Attempting to download: ${filename}`);
    
    // Direct browser download - safest option
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('Download triggered');
    }, 100);
  }
}

// Make available globally
window.DataExporter = DataExporter;
console.log('DataExporter initialized and available globally');
