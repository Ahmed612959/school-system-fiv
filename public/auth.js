// auth.js - النسخة الآمنة مع HttpOnly Cookies
document.addEventListener('DOMContentLoaded', function () {

    // تسجيل الدخول
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
                if (submitBtn) { submitBtn.innerHTML = originalBtnText; submitBtn.disabled = false; }
                return;
            }

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include' // مهم جداً لإرسال واستقبال cookies
                });

                let data;
                try {
                    data = await response.json();
                } catch (parseError) {
                    console.error('❌ Parse Error:', parseError);
                    throw new Error('السيرفر رد برد غير مفهوم');
                }

                if (response.ok && data.success) {
                    console.log('✅ تسجيل دخول ناجح!');
                    
                    // لم نعد نخزن في localStorage
                    // فقط نعرض رسالة ونوجه
                    alert(`🎉 مرحباً ${data.user.fullName}!`);
                    
                    // التوجيه حسب نوع المستخدم
                    if (data.user.type === 'admin') {
                        location.href = 'admin.html';
                    } else {
                        location.href = 'Home.html';
                    }
                    
                } else if (response.status === 423) {
                    // الحساب مقفل
                    alert(`🔒 ${data.error}`);
                } else {
                    alert(data.error || '❌ فشل تسجيل الدخول!');
                }

            } catch (err) {
                console.error('🔥 Login Error:', err.message);
                alert(`⚠️ فشل الاتصال بالخادم!\n\n${err.message}`);
            } finally {
                if (submitBtn) { submitBtn.innerHTML = originalBtnText; submitBtn.disabled = false; }
            }
        });
    }

    // التحقق من الجلسة عند تحميل أي صفحة محمية
    const currentPage = location.pathname.split('/').pop().toLowerCase();
    const protectedPages = ['home.html', 'admin.html', 'profile.html', 'index.html'];
    
    if (protectedPages.includes(currentPage)) {
        checkSession();
    }

    // عرض بيانات المستخدم في الصفحة (تُجلب من السيرفر)
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        fetchUserData(userNameElement);
    }

    // منع inspect element و view source (حماية إضافية)
    document.addEventListener('contextmenu', function(e) {
        if (currentPage === 'admin.html') {
            e.preventDefault();
            return false;
        }
    });

    document.addEventListener('keydown', function(e) {
        if (currentPage === 'admin.html') {
            // منع F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
                (e.ctrlKey && e.key === 'U')) {
                e.preventDefault();
                return false;
            }
        }
    });
});

// دالة التحقق من الجلسة
async function checkSession() {
    try {
        const response = await fetch('/api/check-session', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            // الجلسة غير صالحة - التوجيه لصفحة الدخول
            window.location.href = '/login.html';
            return;
        }
        
        const data = await response.json();
        console.log('✅ Session valid for:', data.user.fullName);
        
        // تخزين بيانات المستخدم في متغير عام فقط (وليس localStorage)
        window.currentUser = data.user;
        
    } catch (error) {
        console.error('❌ Session check failed:', error);
        window.location.href = '/login.html';
    }
}

// دالة جلب بيانات المستخدم للعرض
async function fetchUserData(userNameElement) {
    try {
        const response = await fetch('/api/check-session', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.user && data.user.fullName) {
                userNameElement.textContent = data.user.fullName;
            }
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
}

// دالة تسجيل الخروج
window.logout = async function () {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            if (response.ok) {
                console.log('🚪 User logged out');
                alert('👋 تم تسجيل الخروج بنجاح!');
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
};

// دالة اختبار اتصال السيرفر
window.testServerConnection = async function() {
    console.log('🧪 Testing server connection...');
    try {
        const response = await fetch('/api/test');
        const data = await response.json();
        console.log('✅ Server is working!', data);
        alert(`✅ السيرفر يعمل!\nMongoDB: ${data.mongodb_status || 'unknown'}`);
    } catch(err) {
        console.error('❌ Cannot reach server:', err);
        alert(`❌ لا يمكن الوصول للسيرفر!\n\n${err.message}`);
    }
};

console.log(`
%c🔐 Secure Auth System Loaded
%c------------------------------
%c✓ HttpOnly Cookies
%c✓ Server-Side Authentication
%c✓ CSRF Protection
%c✓ Rate Limiting
%c------------------------------
`, 'color: green; font-weight: bold', 'color: gray', 'color: green', 'color: green', 'color: green', 'color: green', 'color: gray');
