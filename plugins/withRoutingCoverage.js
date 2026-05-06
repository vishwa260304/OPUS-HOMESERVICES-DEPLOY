const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withRoutingCoverage = (config) => {
  // Step 1: Copy the .geojson into the ios/ folder during prebuild
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const src = path.resolve(config.modRequest.projectRoot, 'assets/routing_coverage_india.geojson');
      const dest = path.join(config.modRequest.platformProjectRoot, 'routing_coverage_india.geojson');
      
      try {
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`[withRoutingCoverage] Successfully copied ${src} to ${dest}`);
        } else {
          console.error(`[withRoutingCoverage] Source file not found at ${src}`);
          // We don't want to throw here as it might crash prebuild, 
          // but EAS logs should show this error.
        }
      } catch (error) {
        console.error(`[withRoutingCoverage] Error copying file: ${error.message}`);
      }
      return config;
    },
  ]);

  // Step 2: Add it to the Xcode project
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const fileName = 'routing_coverage_india.geojson';
    
    try {
      const mainTarget = xcodeProject.getFirstTarget();
      if (!mainTarget) {
        console.error('[withRoutingCoverage] Could not find main target in Xcode project');
        return config;
      }

      const targetUuid = mainTarget.uuid;
      
      // Add the file to the project if it's not already there
      // node-xcode's addResourceFile is generally idempotent or handles duplicates well enough for this
      xcodeProject.addResourceFile(fileName, { target: targetUuid });
      console.log(`[withRoutingCoverage] Added ${fileName} to Xcode project target ${targetUuid}`);
    } catch (error) {
      console.error(`[withRoutingCoverage] Error modifying Xcode project: ${error.message}`);
    }
    
    return config;
  });

  return config;
};

module.exports = withRoutingCoverage;
