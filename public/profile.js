document.addEventListener('DOMContentLoaded', async function () {
    // السيرفر على Vercel
    const BASE_URL = 'https://schoolx-five.vercel.app';

    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!loggedInUser) {
        alert('يرجى تسجيل الدخول أولاً!');
        window.location.href = 'login.html';
        return;
    }

    // دالة جلب البيانات
    async function getFromServer(endpoint) {
        try {
            const response = await fetch(`${BASE_URL}/api/${endpoint}`, {
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            console.error('خطأ في جلب البيانات:', err);
            showToast('فشل الاتصال بالسيرفر! تحقق من الإنترنت', 'error');
            return null;
        }
    }

    // دالة حفظ البيانات (تحديث profile)
    async function saveToServer(endpoint, data) {
        try {
            const response = await fetch(`${BASE_URL}/api/${endpoint}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'فشل الحفظ');
            }
            return await response.json();
        } catch (err) {
            console.error('خطأ في الحفظ:', err);
            showToast(err.message || 'فشل حفظ البيانات!', 'error');
            return null;
        }
    }

    // جلب بيانات المستخدم
    let userData = null;
    let userType = loggedInUser.type; // student or admin

    if (userType === 'admin') {
        const admins = await getFromServer('admins');
        userData = admins?.find(a => a.username === loggedInUser.username);
        if (userData) document.getElementById('admin-badge')?.style = 'display:inline-block';
    } else {
        const students = await getFromServer('students');
        userData = students?.find(s => s.username === loggedInUser.username);
    }

    if (!userData) {
        alert('لم يتم العثور على بياناتك!');
        localStorage.removeItem('loggedInUser');
        window.location.href = 'login.html';
        return;
    }

    // تهيئة الـ profile إذا كان فاضي
    userData.profile = userData.profile || {
        email: '', phone: '', birthdate: '', address: '', bio: ''
    };

    // عرض البيانات
    document.getElementById('user-name').textContent = userData.fullName || userData.name || userData.username;
    document.getElementById('full-name').value = userData.fullName || userData.name || '';
    document.getElementById('username').value = userData.username;
    document.getElementById('email').value = userData.profile.email || '';
    document.getElementById('phone').value = userData.profile.phone || '';
    document.getElementById('birthdate').value = userData.profile.birthdate || '';
    document.getElementById('address').value = userData.profile.address || '';
    document.getElementById('bio').value = userData.profile.bio || '';

    // حساب نسبة الاكتمال
    function updateProgress() {
        const fields = ['email', 'phone', 'birthdate', 'address', 'bio'];
        const completed = fields.filter(f => userData.profile[f]?.trim()).length;
        const progress = Math.round((completed / fields.length) * 100);

        const bar = document.getElementById('profile-progress');
        const text = document.getElementById('progress-percentage');
        if (bar) bar.value = progress;
        if (text) text.textContent = `${progress}%`;

        return progress;
    }
    updateProgress();

    // حفظ التعديلات
    document.getElementById('profile-form')?.addEventListener('submit', async function (e) {
        e.preventDefault();

        const updatedProfile = {
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            birthdate: document.getElementById('birthdate').value,
            address: document.getElementById('address').value.trim(),
            bio: document.getElementById('bio').value.trim()
        };

        // تحديث محليًا
        userData.profile = updatedProfile;

        // تحديد المسار الصحيح
        const endpoint = userType === 'admin' 
            ? `admins/${loggedInUser.username}` 
            : `students/${loggedInUser.username}`;

        const saved = await saveToServer(endpoint, { profile: updatedProfile });

        if (saved) {
            const progress = updateProgress();
            showToast('تم حفظ بياناتك بنجاح!', 'success');

            if (progress === 100) {
                setTimeout(() => {
                    showToast('مبروك! ملفك الشخصي مكتمل 100%', 'success');
                }, 1200);
            }
        }
    });

    // النافبار
    const navBar = document.getElementById('nav-bar');
    const navItems = [
        { href: 'index.html', icon: 'fas fa-home', title: 'الرئيسية' },
        { href: 'Home.html', icon: 'fas fa-chart-line', title: 'النتائج' },
        { href: 'profile.html', icon: 'fas fa-user', title: 'الملف الشخصي', active: true },
        { href: 'exams.html', icon: 'fas fa-book', title: 'الاختبارات' },
        { href: 'chatbot.html', icon: 'fas fa-robot', title: 'المساعد الذكي' }
    ];

    if (userType === 'admin') {
        navItems.push({ href: 'admin.html', icon: 'fas fa-cogs', title: 'لوحة التحكم' });
    }

    navBar.innerHTML = navItems.map(item => 
        `<a href="${item.href}" class="${item.active ? 'active' : ''}" title="${item.title}">
            <i class="${item.icon}"></i>
         </a>`
    ).join('');

    // Toast أنيق جدًا
    function showToast(message, type = 'success') {
        const bg = type === 'success' ? '#28a745' : '#dc3545';
        Toastify({
            text: message,
            duration: 4000,
            gravity: "top",
            position: "center",
            backgroundColor: bg,
            style: {
                fontFamily: '"Cairo", sans-serif',
                fontSize: "17px",
                padding: "18px 30px",
                borderRadius: "16px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                direction: "rtl"
            }
        }).showToast();
    }

    // رسالة ترحيب
    showToast(`أهلاً يا ${userData.fullName?.split(' ')[0] || 'بطل'}!`, 'success');
});
