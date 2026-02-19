const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Replace react-native-screens with our mock on iOS
    // This fixes crashes with New Architecture in RN 0.83
    resolveRequest: (context, moduleName, platform) => {
      // Intercept all react-native-screens imports on iOS
      if (platform === 'ios' && 
          (moduleName === 'react-native-screens' || 
           moduleName.startsWith('react-native-screens/'))) {
        // For the main module and any subpaths, use our mock
        return {
          filePath: path.resolve(__dirname, 'src/react-native-screens-mock.js'),
          type: 'sourceFile',
        };
      }
      // Fall back to default resolution
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
