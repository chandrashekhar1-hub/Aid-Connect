// Global variable to store the phone verification result
let confirmationResult = null;

// Initialize reCAPTCHA on load
window.onload = () => {
    try {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                // reCAPTCHA solved, allow signInWithPhoneNumber.
            }
        });
    } catch(e) {
        console.warn("reCAPTCHA init skipped due to missing config");
    }
};

/* ================= LOGIN PATH ================= */
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    
    setBtnLoading('login-btn', true);
    
    // DEMO BYPASS: Simulate successful login without Firebase keys
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        setTimeout(() => {
            showToast('DEMO MODE: Login successful! Redirecting...', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 1500);
            setBtnLoading('login-btn', false);
        }, 1000);
        return;
    }

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, pass);
        // Check Firestore for user existence/verification
        const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
        
        if (!userDoc.exists) {
            // Edge case: User exists in Auth but not Firestore
            showToast('User profile incomplete. Please register properly.', 'error');
            auth.signOut();
        } else {
            const userData = userDoc.data();
            showToast(`Welcome back, ${userData?.role || 'User'}! Redirecting...`, 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        setBtnLoading('login-btn', false);
    }
});

/* ================= GOOGLE OAUTH ================= */
async function signInWithGoogle() {
    // DEMO BYPASS: Simulate successful Google login without Firebase keys
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        showToast('DEMO MODE: Signed in with Google!', 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
        return;
    }

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // Check if user already exists in Firestore
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            // First time login with Google -> save default role
            await userRef.set({
                email: user.email,
                phone: user.phoneNumber || "Not provided",
                role: "Donor", // Default role for Google sign-in
                verified: true,
                authProvider: "Google",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Account created via Google!', 'success');
        } else {
            showToast('Signed in with Google!', 'success');
        }
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);

    } catch (error) {
        showToast(error.message, 'error');
    }
}

/* ================= OTP VERIFICATION & REGISTER ================= */

// Step 1: Send OTP
async function sendOTP() {
    const phoneInput = document.getElementById('reg-phone').value;
    
    if (!phoneInput || phoneInput.length < 10) {
        showToast('Please enter a valid phone number with country code (e.g., +91).', 'error');
        return;
    }

    setBtnLoading('send-otp-btn', true);
    
    // DEMO BYPASS: If API key is not set, simulate OTP delivery for testing UI
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        setTimeout(() => {
            showToast('DEMO MODE: OTP sent! Use 123456', 'success');
            document.getElementById('send-otp-btn').style.display = 'none';
            document.getElementById('otp-section').style.display = 'block';
            confirmationResult = { confirm: async (otp) => { 
                if(otp !== '123456') throw new Error('Invalid Mock OTP'); 
                return { user: { uid: 'demo-user-123' } }; 
            }};
            setBtnLoading('send-otp-btn', false);
        }, 1500);
        return;
    }

    try {
        const appVerifier = window.recaptchaVerifier;
        if(!appVerifier) throw new Error("reCAPTCHA not initialized. Check Firebase config.");
        
        confirmationResult = await auth.signInWithPhoneNumber(phoneInput, appVerifier);
        
        showToast('OTP code sent via SMS!', 'success');
        
        // Update UI
        document.getElementById('send-otp-btn').style.display = 'none';
        document.getElementById('otp-section').style.display = 'block';
    } catch (error) {
        showToast(error.message, 'error');
        // Reset recaptcha if failed
        if(window.recaptchaVerifier) window.recaptchaVerifier.render().then(widgetId => {
            grecaptcha.reset(widgetId);
        });
    } finally {
        setBtnLoading('send-otp-btn', false);
    }
}

// Step 2: Verify OTP
async function verifyOTP() {
    const otpInput = document.getElementById('reg-otp').value;
    
    if (!otpInput || otpInput.length !== 6) {
        showToast('Please enter the 6-digit OTP.', 'error');
        return;
    }
    
    try {
        // We verify the OTP, but we DO NOT want to stay logged in strictly as the phone user.
        // We link it later, or we just trust the session temporarily.
        // For simplicity in this flow: we confirm the OTP.
        const result = await confirmationResult.confirm(otpInput);
        
        showToast('Phone verified successfully!', 'success');
        
        // Update UI
        document.getElementById('otp-section').style.display = 'none';
        document.getElementById('register-btn').style.display = 'flex';
        
    } catch (error) {
        showToast('Invalid OTP. Please try again.', 'error');
    }
}

// Step 3: Complete Final Registration (Email/Pass + Firestore)
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-password').value;
    const phone = document.getElementById('reg-phone').value;
    const role = document.getElementById('reg-role').value;
    
    if (!role) {
        showToast('Please select a role.', 'error');
        return;
    }
    
    setBtnLoading('register-btn', true);
    
    // DEMO BYPASS: Simulate successful registration without Firebase keys
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        setTimeout(() => {
            showToast('DEMO MODE: Registration simulate success! Redirecting...', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 1500);
            setBtnLoading('register-btn', false);
        }, 1000);
        return;
    }

    try {
        // Because confirmationResult.confirm() logged us in as a Phone user,
        // we can link the email/password credential to this phone account securely.
        const credential = firebase.auth.EmailAuthProvider.credential(email, pass);
        await auth.currentUser.linkWithCredential(credential);
        
        // Store in Firestore
        await db.collection('users').doc(auth.currentUser.uid).set({
            email: email,
            phone: phone,
            role: role,
            verified: true,
            authProvider: "Phone+Email",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Registration complete! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch (error) {
        // Handle error: e.g. Email already exists
        if (error?.code === 'auth/credential-already-in-use' || error?.code === 'auth/email-already-in-use') {
            showToast('Email is already in use. Please sign in.', 'error');
        } else {
            showToast(error.message || "Registration failed", 'error');
        }
    } finally {
        setBtnLoading('register-btn', false);
    }
});

/* ================= FORGOT PASSWORD ================= */
async function forgotPassword() {
    const email = document.getElementById('login-email').value;
    if (!email) {
        showToast('Please enter your email address first to send a reset link.', 'error');
        return;
    }
    
    try {
        await auth.sendPasswordResetEmail(email);
        showToast('Password reset link sent to your email.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}
