// ============================================
// FIREBASE CONFIGURATION
// ============================================
// Shared Firebase configuration for all pages
// Replace these with your actual Firebase config from:
// Firebase Console → Project Settings → Your apps → Web app

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase (only if not already initialized)
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Get Firestore instance
function getFirestore() {
    if (typeof firebase !== 'undefined') {
        return firebase.firestore();
    }
    return null;
}
