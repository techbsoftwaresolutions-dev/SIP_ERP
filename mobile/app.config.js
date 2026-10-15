require("dotenv").config();

export default {
expo: {
// What shows under the app icon on the phone.
name: "SIPERP",

// Internal identifiers stay as they were: changing the slug, scheme or the
// bundle / package ids would make stores and EAS treat this as a different app.
slug: "CRM-industrial-crm",

version: "1.0.0",

orientation: "portrait",

scheme: "siperp",

userInterfaceStyle: "light",

icon: "./assets/icon.png",

splash: {
  image: "./assets/splash.png",
  resizeMode: "contain",
  backgroundColor: "#ffffff",
},

ios: {
  supportsTablet: true,
  bundleIdentifier: "com.crmindustrial.app",
},

android: {
  package: "com.crmindustrial.app",

  adaptiveIcon: {
    foregroundImage: "./assets/adaptive-icon.png",
    backgroundColor: "#ffffff",
  },
},

web: {
  bundler: "metro",
  favicon: "./assets/favicon.png",
},

extra: {
  apiBaseUrl: process.env.API_BASE_URL,

  eas: {
    projectId: "7bcc39e8-919d-4ca1-98d3-18fe801deba2",
  },
},

},
};
