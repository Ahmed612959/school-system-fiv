// auth.js - النسخة المعدلة بعد إزالة bcrypt
document.addEventListener('DOMContentLoaded', function () {

    // تسجيل الدخول
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            // عرض حالة التحميل
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
                console.log('📤 [1/4] جاري إرسال طلب تسجيل الدخول لـ:', username);
                console.log('📤 [1/4] URL:', '/api/login');

                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ username, password })
                });

                console.log('📥 [2/4] HTTP Status:', response.status, response.statusText);

                // قراءة الرد
                let data;
                try {
                    const text = await response.text();
                    console.log('📥 [2/4] Raw Response Body:', text.substring(0, 200));
                    data = text ? JSON.parse(text) : {};
                } catch (parseError) {
                    console.error('❌ [2/4] JSON Parse Error:', parseError);
                    throw new Error('السيرفر رد برد غير مفهوم');
                }

                if (response.ok && data.success) {
                    console.log('✅ [3/4] تسجيل دخول ناجح!');
                    
                    const userData = {
                        username: data.user.username,
                        fullName: data.user.fullName,
                        type: data.user.type,
                        ...(data.user.id && { id: data.user.id })
                    };
                    
                    localStorage.setItem('loggedInUser', JSON.stringify(userData));
                    console.log('✅ [3/4] تم حفظ بيانات المستخدم:', userData);
                    
                    alert(`🎉 مرحباً ${data.user.fullName}! (${data.user.type === 'admin' ? 'مدير' : 'طالب'})`);
                    
                    // التوجيه حسب نوع المستخدم
                    if (data.user.type === 'admin') {
                        console.log('🚀 [4/4] التوجيه إلى Admin.html');
                        location.href = 'Admin.html';
                    } else {
                        console.log('🚀 [4/4] التوجيه إلى Home.html');
                        location.href = 'Home.html';
                    }
                    
                } else {
                    console.log('❌ [3/4] فشل تسجيل الدخول');
                    
                    if (data.error) {
                        if (data.error.includes('بيانات غير صحيحة')) {
                            alert('❌ اسم المستخدم أو كلمة المرور غير صحيحة!');
                        } else if (data.error.includes('قاعدة البيانات')) {
                            alert(`❌ مشكلة في الاتصال بقاعدة البيانات!\n\n${data.error}`);
                        } else {
                            alert(`❌ فشل تسجيل الدخول: ${data.error}`);
                        }
                    } else {
                        alert('❌ اسم المستخدم أو كلمة المرور غير صحيحة!');
                    }
                }

            } catch (err) {
                console.error('🔥 [ERROR] تفاصيل الخطأ:', err.message);
                
                let userMessage = '';
                if (err.message.includes('السيرفر لا يعمل')) {
                    userMessage = '⚠️ السيرفر في طور التشغيل، حاول مرة أخرى بعد دقيقة.';
                } else if (err.message.includes('مكتبة مفقودة')) {
                    userMessage = '⚠️ خطأ في تهيئة السيرفر، يرجى إعادة نشر المشروع.';
                } else if (err.message.includes('اتصال بقاعدة البيانات')) {
                    userMessage = '⚠️ مشكلة في الاتصال بقاعدة البيانات، تواصل مع المدير الفني.';
                } else if (err.message.includes('غير مفهوم')) {
                    userMessage = '⚠️ السيرفر لا يستجيب بشكل صحيح. تأكد من تشغيله.';
                } else {
                    userMessage = `⚠️ فشل الاتصال بالخادم!\n\n${err.message}\n\n💡 تأكد من:\n1. السيرفر يعمل على Vercel\n2. متغير MONGODB_URI مضاف\n3. راجع Vercel Logs لمزيد من التفاصيل`;
                }
                
                alert(userMessage);
                
                console.log('\n💡 === نصائح للتشخيص ===');
                console.log('1. افتح Vercel Dashboard → مشروعك → Deployments');
                console.log('2. اضغط على آخر deployment');
                console.log('3. اذهب إلى "Functions" لترى logs السيرفر');
                console.log('4. جرب رابط /api/test للتحقق من صحة السيرفر');
                console.log('========================\n');
                
            } finally {
                // إعادة زر التحميل
                if (submitBtn) {
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                }
            }
        });
    }

    // حماية الصفحات
    const currentPage = location.pathname.split('/').pop().toLowerCase();
    console.log('🔐 Checking page access:', currentPage);
    
    const protectedPages = ['home.html', 'admin.html', 'profile.html', 'index.html'];
    if (protectedPages.includes(currentPage)) {
        const userData = localStorage.getItem('loggedInUser');
        const user = userData ? JSON.parse(userData) : null;
        
        console.log('🔐 Current user:', user);
        
        if (!user) {
            console.warn('🔐 No user found - redirecting to login');
            alert('يرجى تسجيل الدخول أولاً!');
            location.href = 'login.html';
            return;
        }

        // التحقق من صلاحيات الوصول
        if (user.type === 'student' && currentPage === 'admin.html') {
            console.warn('🔐 Student trying to access admin page - blocked');
            alert('⛔ غير مصرح لك بالدخول إلى لوحة الإدارة!');
            location.href = 'Home.html';
            return;
        }

        // عرض اسم المستخدم في الصفحة إذا وجد عنصر
        const userNameElement = document.getElementById('user-name');
        if (userNameElement && user.fullName) {
            userNameElement.textContent = user.fullName;
        }
        
        console.log('🔐 Access granted for:', user.fullName);
    }
});

// دالة تسجيل الخروج
window.logout = function () {
    const user = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
    const userName = user?.fullName || 'المستخدم';
    
    if (confirm(`هل أنت متأكد من تسجيل الخروج، ${userName}؟`)) {
        localStorage.removeItem('loggedInUser');
        console.log('🚪 User logged out');
        alert('👋 تم تسجيل الخروج بنجاح!');
        location.href = 'login.html';
    }
};

// دالة اختبار اتصال السيرفر
window.testServerConnection = async function() {
    console.log('🧪 Testing server connection...');
    try {
        const response = await fetch('/api/test');
        const text = await response.text();
        console.log('🧪 Response:', text);
        
        try {
            const data = JSON.parse(text);
            console.log('✅ Server is working!');
            console.log('📊 Status:', data);
            alert(`✅ السيرفر يعمل!\n\nMongoDB: ${data.mongodb_status || 'unknown'}\n${data.message || ''}`);
        } catch(e) {
            console.error('❌ Server returned non-JSON:', text.substring(0, 200));
            alert(`⚠️ السيرفر رد بـ non-JSON:\n${text.substring(0, 200)}`);
        }
    } catch(err) {
        console.error('❌ Cannot reach server:', err);
        alert(`❌ لا يمكن الوصول للسيرفر!\n\n${err.message}`);
    }
};

// دالة إنشاء مدير تجريبي (مفيدة للتجربة)
window.createTestAdmin = async function() {
    console.log('🧪 Creating test admin...');
    try {
        const response = await fetch('/api/create-test-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        console.log('📊 Response:', data);
        
        if (data.message) {
            alert(`✅ ${data.message}\n\n👤 username: ${data.username}\n🔑 password: ${data.password}`);
        } else {
            alert(`❌ خطأ: ${data.error}`);
        }
    } catch(err) {
        console.error('❌ Error:', err);
        alert(`❌ فشل الاتصال: ${err.message}`);
    }
};

// عرض معلومات مساعدة في console عند تحميل الصفحة
console.log(`
%c🔐 Auth System Loaded (No bcrypt version)
%c---------------------------------------
%c✓ Version: 3.0 (Using crypto for password hashing)
%c✓ To test server: testServerConnection()
%c✓ To create admin: createTestAdmin()
%c✓ Current page: ${location.pathname}
%c---------------------------------------
`, 'color: green; font-weight: bold', 'color: gray', 'color: blue', 'color: blue', 'color: blue', 'color: blue', 'color: gray');
