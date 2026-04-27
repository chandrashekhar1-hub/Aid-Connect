// UI interaction logic

// Tab switching (Login vs Register)
function toggleView(view) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    if (view === 'login') {
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
    }
}

// Demo Accounts Autofill
function autofill(role) {
    toggleView('login');
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    
    if (role === 'admin') {
        emailInput.value = 'admin@example.com';
        passInput.value = 'Admin@123';
    } else if (role === 'volunteer') {
        emailInput.value = 'volunteer@example.com';
        passInput.value = 'Vol@123';
    } else if (role === 'donor') {
        emailInput.value = 'donor@example.com';
        passInput.value = 'Donor@123';
    }
    
    showToast(`Autofilled ${role} credentials`, 'success');
}

// Button loading state
function setBtnLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    if (isLoading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
