// js/firebase.js — the Firebase setup.
// Parts in this file:
//   1) Your Firebase project address (the config)
//   2) Load Firebase from Google, only when it is needed
// Why load it late? So the shop still shows products even if
// the internet is slow or Google is blocked for a moment.

// This is your real Firebase project: ShopNest (shopnest-76167).
// It was created on the free Spark plan.
// If you ever make a new Firebase project, paste its new
// config here (Firebase Console > Project settings > Your apps).
export const firebaseConfig = {
  apiKey: "AIzaSyDz9XUQcu1_9fq1nBRQIB8PepgCtr8PT6M",
  authDomain: "shopnest-76167.firebaseapp.com",
  projectId: "shopnest-76167",
  storageBucket: "shopnest-76167.firebasestorage.app",
  messagingSenderId: "1007997025598",
  appId: "1:1007997025598:web:cb5108314d83593958806f",
};

// This is true when a real config is filled in above.
// (It is false only if the placeholder text is still there.)
export const FIREBASE_CONFIGURED =
  firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE" &&
  firebaseConfig.projectId !== "PASTE_YOUR_PROJECT_ID";

// The email of the shop owner. Only this person can see Admin.
// To change the owner, change this email AND the same email
// inside firestore.rules.
export const ADMIN_EMAIL = "mohendhroghoshrohit@gmail.com";

// The web address where the Firebase tools live.
const FIREBASE_CDN = "https://www.gstatic.com/firebasejs/10.12.2";

// We keep the loaded Firebase tools here, so we only load them once.
let loadedFirebaseTools = null;

// We keep the loading promise here, so two clicks at the same
// time do not start two downloads.
let loadingPromise = null;

// ----- LOAD FIREBASE PART -----
// Load the Firebase tools from Google and start the app.
// This runs only the first time someone needs Firebase.
async function loadFirebaseSdk() {
  // Fetch the three toolboxes we need: the app, login, and database.
  const appTools = await import(FIREBASE_CDN + "/firebase-app.js");
  const loginTools = await import(FIREBASE_CDN + "/firebase-auth.js");
  const databaseTools = await import(FIREBASE_CDN + "/firebase-firestore.js");

  // Start Firebase with our project config.
  const app = appTools.initializeApp(firebaseConfig);

  // Put all the tools into one box, so other files can use them
  // with one simple name: firebase.auth, firebase.db, and so on.
  loadedFirebaseTools = {
    app,
    auth: loginTools.getAuth(app),
    db: databaseTools.getFirestore(app),
    ...loginTools,
    ...databaseTools,
  };
  return loadedFirebaseTools;
}

// ----- GET FIREBASE PART -----
// Get the Firebase tools, or null if Firebase cannot be reached.
// Every file that needs Firebase calls this function first.
// Returning null (instead of crashing) is on purpose: the shop
// keeps showing products even when Firebase is offline.
export async function getFirebase() {
  if (!FIREBASE_CONFIGURED) {
    return null;
  }
  if (loadedFirebaseTools) {
    return loadedFirebaseTools;
  }
  if (!loadingPromise) {
    // If the download fails, forget the failed promise so the
    // next try can start a fresh download.
    loadingPromise = loadFirebaseSdk().catch(() => {
      loadingPromise = null;
      return null;
    });
  }
  return loadingPromise;
}
