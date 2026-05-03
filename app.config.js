export default {
  expo: {
    name: "FIXIT",
    slug: "fixit-customer-app",
    owner: "ciel.ai",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/Fixit_logo.png",
    scheme: "fixit",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    ios: {
      bundleIdentifier: "com.ciel.fixit",
      supportsTablet: true,
      buildNumber: "1",
      associatedDomains: ["applinks:fixit.ciel.ai"],
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "FIXIT uses your location to show nearby service providers.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "FIXIT uses your location to find services near you.",
        NSCameraUsageDescription: "FIXIT needs camera access for KYC document scanning and profile photos.",
        NSPhotoLibraryUsageDescription: "FIXIT accesses your photos to upload a profile picture.",
        NSPhotoLibraryAddUsageDescription: "FIXIT saves booking receipts and images to your library.",
        UIBackgroundModes: ["fetch", "remote-notification"],
        NSUserActivityTypes: ["NSUserActivityTypeBrowsingWeb"],
      },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyCollectedDataTypes: [
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
          },
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhoneNumber",
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
          },
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeDeviceID",
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
          },
        ],
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
            NSPrivacyAccessedAPITypeReasons: ["C617.1"],
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
            NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
          },
        ],
      },
    },
    android: {
      package: "com.ciel.fixit",
      adaptiveIcon: {
        foregroundImage: "./assets/images/Fixit_logo.png",
        backgroundColor: "#0b7ef2",
      },
      edgeToEdgeEnabled: true,
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/Fixit_logo.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/Fixit_logo.png",
          backgroundColor: "#004c8f",
          imageWidth: 200,
          resizeMode: "contain",
          ios: {
            resizeMode: "contain",
          },
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/Fixit_logo.png",
          color: "#004c8f",
        },
      ],
      "expo-web-browser",
      "@sentry/react-native",
      "expo-secure-store",
      [
        "expo-build-properties",
        {
          android: {
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      EXPO_PUBLIC_RAZORPAY_KEY_ID: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
      EXPO_PUBLIC_MIXPANEL_TOKEN: process.env.EXPO_PUBLIC_MIXPANEL_TOKEN,
      EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
      eas: {
        projectId: "b852e5b1-705f-4746-b2e9-777706e2bf69",
      },
    },    
  },
};
