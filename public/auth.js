// auth.js - النسخة المحسنة مع حماية متقدمة

// ====================== حماية Page Source ======================
(function protectPageSource() {
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
            (e.ctrlKey && e.key === 'U')) {
            e.preventDefault();
            return false;
        }
    });
    
    function detectDevTools() {
        const threshold = 160;
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        if (widthThreshold || heightThreshold) {
            console.clear();
            document.body.innerHTML = '<div style="text-align:center; padding:50px;"><h1>⚠️ غير مسموح بفتح أدوات المطور</h1><p>يرجى إغلاق أدوات المطور للمتابعة</p></div>';
        }
    }
    setInterval(detectDevTools, 1000);
})();

// ====================== متغيرات الجلسة ======================
let authToken = null;
let csrfToken = null;

// ====================== اعتراض جميع الطلبات وإضافة التوكن ======================
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const token = sessionStorage.getItem('authToken');
    const csrf = window.csrfToken || sessionStorage.getItem('csrfToken');
    
    if (token && !args[1]) {
        args[1] = {};
    }
    if (token && args[1]) {
        args[1].headers = {
            ...args[1].headers,
            'Authorization': `Bearer ${token}`,
            'X-CSRF-Token': csrf || ''
        };
        args[1].credentials = 'include';
    }
    return originalFetch.apply(this, args);
};

// ====================== التحقق من صحة الجلسة ======================
async function verifySession() {
    const token = sessionStorage.getItem('authToken');
    if (!token) return false;
    
    try {
        const response = await fetch('/api/verify-session', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        return data.valid;
    } catch (error) {
        return false;
    }
}

setInterval(async () => {
    const isValid = await verifySession();
    if (!isValid) {
        logout();
    }
}, 10 * 60 * 1000);

// ====================== تسجيل الدخول ======================
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn?.innerHTML || 'تسجيل الدخول';
            if (submitBtn) {
                submitBtn.innerHTML = '⏳ جاري التسجيل...';
                submitBtn.disabled = true;
            }

            if (!username || !password) {
                alert('⚠️ يرجى إدخال اسم المستخدم وكلمة المرور!');
                if (submitBtn) {
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                }
                return;
            }

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    authToken = data.token;
                    csrfToken = data.csrfToken;
                    
                    sessionStorage.setItem('authToken', authToken);
                    sessionStorage.setItem('csrfToken', csrfToken);
                    sessionStorage.setItem('userData', JSON.stringify(data.user));
                    
                    window.authToken = authToken;
                    window.csrfToken = csrfToken;
                    
                    alert(`🎉 مرحباً ${data.user.fullName}!`);
                    
                    if (data.user.type === 'admin') {
                        location.href = 'admin.html';
                    } else {
                        location.href = 'Home.html';
                    }
                } else {
                    alert(data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة!');
                }

            } catch (err) {
                console.error('Login Error:', err);
                alert('فشل الاتصال بالخادم! تأكد من الإنترنت وجرب مرة أخرى.');
            } finally {
                if (submitBtn) {
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                }
            }
        });
    }

    // ====================== حماية الصفحات ======================
    const currentPage = location.pathname.split('/').pop().toLowerCase();
    const protectedPages = ['home.html', 'admin.html', 'profile.html', 'index.html'];
    
    if (protectedPages.includes(currentPage)) {
        const token = sessionStorage.getItem('authToken');
        const userData = JSON.parse(sessionStorage.getItem('userData') || 'null');
        
        if (!token || !userData) {
            console.warn('🔐 No valid session - redirecting to login');
            alert('يرجى تسجيل الدخول أولاً!');
            location.href = 'login.html';
            return;
        }
        
        fetch('/api/verify-session', {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()).then(data => {
            if (!data.valid) {
                sessionStorage.clear();
                location.href = 'login.html';
            }
        }).catch(() => {
            sessionStorage.clear();
            location.href = 'login.html';
        });
        
        if (userData.type === 'student' && currentPage === 'admin.html') {
            alert('⛔ غير مصرح لك بالدخول إلى لوحة الإدارة!');
            location.href = 'Home.html';
            return;
        }
        
        console.log('🔐 Access granted for:', userData.fullName);
    }
});

// ====================== تسجيل الخروج الآمن ======================
window.logout = async function () {
    const token = sessionStorage.getItem('authToken');
    if (token) {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch(e) {}
    }
    sessionStorage.clear();
    localStorage.clear();
    location.href = 'login.html';
};

window.testServerConnection = async function() {
    try {
        const response = await fetch('/api/test');
        const data = await response.json();
        alert(`✅ السيرفر يعمل!\nMongoDB: ${data.mongodb_status || 'unknown'}`);
    } catch(err) {
        alert(`❌ لا يمكن الوصول للسيرفر!\n${err.message}`);
    }
};

window.createTestAdmin = async function() {
    try {
        const response = await fetch('/api/create-test-admin', { method: 'POST' });
        const data = await response.json();
        alert(`✅ ${data.message}\n👤 username: ${data.username}\n🔑 password: ${data.password}`);
    } catch(err) {
        alert(`❌ فشل الاتصال: ${err.message}`);
    }
};

console.log(`
%c🔐 Auth System Loaded (Secure Version)
%c---------------------------------------
%c✓ Version: 4.0 (JWT + Session + CSRF Protection + scrypt)
%c✓ To test server: testServerConnection()
%c✓ To create admin: createTestAdmin()
%c---------------------------------------
`, 'color: green; font-weight: bold', 'color: gray', 'color: blue', 'color: blue', 'color: blue', 'color: gray');