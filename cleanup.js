/**
 * Pre-publish cleanup script for docusaurus-plugin-llms
 * This script removes unnecessary files from the lib directory that were generated
 * from deleted source files but are still compiled by TypeScript.
 */

const fs = require('fs');
const path = require('path');

// Files and directories to remove from lib
const toRemove = [
  // 'types.js',
  // 'types.d.ts',
  'constants.js',
  'constants.d.ts',
  'helpers',
  'remark-plugins'
];

// Helper to remove a directory recursively
function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach(file => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        removeDir(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
    console.log(`✓ Removed directory: ${dirPath}`);
  }
}

// Main cleanup function
function cleanup() {
  const libDir = path.join(__dirname, 'lib');
  
  if (!fs.existsSync(libDir)) {
    console.warn('⚠️ lib directory not found, nothing to clean up.');
    return;
  }
  
  console.log('Cleaning up lib directory before publishing...');
  
  // Process each item to remove
  toRemove.forEach(item => {
    const itemPath = path.join(libDir, item);
    
    if (fs.existsSync(itemPath)) {
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        removeDir(itemPath);
      } else {
        fs.unlinkSync(itemPath);
        console.log(`✓ Removed file: ${itemPath}`);
      }
    }
  });
  
  console.log('✓ Cleanup complete!');
}

// Run the cleanup
cleanup(); 