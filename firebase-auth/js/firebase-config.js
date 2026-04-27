/**
 * Replace this configuration with your actual Firebase project config.
 * 
 * Instructions:
 * 1. Go to Firebase Console (https://console.firebase.google.com/)
 * 2. Create a new project or open an existing one
 * 3. Go to Project Settings -> General -> "Your apps" (Web app)
 * 4. Copy the firebaseConfig object and paste it below
 * 
 * ENABLE THE FOLLOWING IN FIREBASE CONSOLE:
 * - Authentication -> Sign-in methods -> Email/Password
 * - Authentication -> Sign-in methods -> Google
 * - Authentication -> Sign-in methods -> Phone
 * - Firestore Database -> Create Database (Start in test mode or update rules)
 */

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
} catch (error) {
    console.warn("Firebase not initialized. Did you replace the config keys?", error);
}

// Get references to Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Set Auth persistence to LOCAL (keeps user logged in)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((error) => console.error("Error setting persistence:", error));
