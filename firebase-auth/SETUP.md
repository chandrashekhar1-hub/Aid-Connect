# Firebase Premium Authentication - Setup Guide

This folder contains a fully functional, serverless Firebase Authentication frontend application. It supports Email/Password, Google OAuth, and Phone Verification (OTP) along with Firestore document saving for user roles and properties.

## 📁 Folder Structure
```text
firebase-auth/
├── index.html           # Main Authentication Portal
├── dashboard.html       # Post-login Protected Page
├── SETUP.md             # This file
├── css/
│   └── style.css        # Premium glassmorphic UI + Dark Gradients
└── js/
    ├── firebase-config.js # Firebase API Keys
    ├── auth.js          # Core Authentication/Firestore Logic
    └── ui.js            # UI toggles, toasts, spinners
```

## 🚀 How to Make It Live

To make the login buttons truly functional, you need to link this application to your own Firebase project.

### Step 1: Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and give it a name.
3. Once created, click on the **Web icon (</>)** on the project overview page to register an app.
4. Firebase will output a `firebaseConfig` object containing your keys.
5. Open `js/firebase-config.js` and **replace** the dummy keys with your newly generated keys.

### Step 2: Enable Authentication Methods
In the Firebase Console menu (left side), click on **Build > Authentication**, then click **Get Started**. Go to the **Sign-in method** tab.

Enable the following providers:
1. **Email/Password**: Click 'Enable' and save.
2. **Google**: Click 'Enable', select your support email address, and save.
3. **Phone**: Click 'Enable'. Note: Firebase limits SMS messages for abuse prevention. You can add your personal phone number as a "Testing" number in this tab to test OTPs without limits.

### Step 3: Setup Firestore Database
In the Firebase Console menu, click on **Build > Firestore Database**, then click **Create database**.
1. Choose **Start in test mode** (this allows reads/writes for testing).
2. Choose a server location closest to you.
3. Click Enable.

> Note: For production use, you *must* update your Firestore Security Rules so users can only write to their own profile documents.

## 🎉 Run the App
Simply open `index.html` in a modern web browser! 
- Registration requires OTP first.
- Clicking demo accounts will auto-fill email/password inputs.
- The UI features animated gradients, smooth tooltips (`toast`), and loading spinners exactly like AidConnect.
