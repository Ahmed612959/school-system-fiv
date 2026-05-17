// دالة لعرض رسائل التنبيه
function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        background-color: ${type === 'success' ? '#28a745' : '#dc3545'};
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// إرسال طلب إلى الخادم
async function saveToServer(endpoint, data) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'خطأ في الخادم');
        }
        return result;
    } catch (error) {
        console.error('خطأ في الاتصال بالخادم:', error);
        throw error;
    }
}

// التحقق من توفر اسم المستخدم
async function checkUsernameAvailability(username) {
    try {
        const response = await fetch('/api/check-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await response.json();
        console.log('Backend response for username check:', data);
        return data && typeof data.available === 'boolean' ? data.available : false;
    } catch (error) {
        console.error('خطأ في التحقق من اسم المستخدم:', error);
        return false;
    }
}

// معالجة نموذج إنشاء حساب الطالب
document.getElementById('student-signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const studentCode = document.getElementById('studentCode').value.replace(/\s/g, '').trim();
    const phone = document.getElementById('phone').value.trim();
    const parentName = document.getElementById('parentName').value.trim();
    const parentId = document.getElementById('parentId').value.replace(/\s/g, '').trim();

    // إعادة تعيين رسائل الخطأ
    document.getElementById('username-availability').style.display = 'none';

    // التحقق من الحقول الفارغة (مع حذف المسافات الزيادة)
    if (
        fullName === '' ||
        username === '' ||
        password === '' ||
        studentCode === '' ||
        phone === '' ||
        parentName === '' ||
        parentId === ''
    ) {
        showToast('يرجى ملء جميع الحقول!', 'error');
        return;
    }

    // التحقق من رقم الجلوس (1-7 أرقام)
    if (!/^\d{1,7}$/.test(studentCode)) {
        showToast('رقم الجلوس يجب أن يكون من 1 إلى 7 أرقام فقط!', 'error');
        return;
    }

    // التحقق من رقم البطاقة (14 رقم بالظبط)
    if (parentId.length !== 14 || !/^\d{14}$/.test(parentId)) {
        showToast('رقم بطاقة ولي الأمر يجب أن يكون 14 رقم بالظبط بدون مسافات!', 'error');
        return;
    }

    // التحقق من صيغة اسم المستخدم
    if (!/^[a-zA-Z0-9]{3,20}$/.test(username)) {
        showToast('اسم المستخدم: 3-20 حرف (أحرف وأرقام فقط)!', 'error');
        return;
    }

    // التحقق من توفر اسم المستخدم
    showToast('جاري التحقق من اسم المستخدم...', 'info');
    const isUsernameAvailable = await checkUsernameAvailability(username);
    const availabilitySpan = document.getElementById('username-availability');
    if (!isUsernameAvailable) {
        availabilitySpan.textContent = 'اسم المستخدم مستخدم من قبل!';
        availabilitySpan.style.color = '#dc3545';
        availabilitySpan.style.display = 'block';
        showToast('اسم المستخدم مستخدم من قبل!', 'error');
        return;
    } else {
        availabilitySpan.textContent = 'اسم المستخدم متاح!';
        availabilitySpan.style.color = '#28a745';
        availabilitySpan.style.display = 'block';
    }

    try {
        showToast('جاري إنشاء الحساب...', 'info');
       const response = await saveToServer('/api/register-student', {
    fullName,
    username,
    studentCode: studentCode,
    phone,
    parentName,
    parentId,
    password
});

        showToast(`تم إنشاء الحساب بنجاح! اسم المستخدم: ${response.username}`, 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);

    } catch (error) {
        console.error('خطأ في إنشاء الحساب:', error);
        const msg = error.message || '';
        if (msg.includes('رقم الجلوس') || msg.includes('id')) {
            showToast('رقم الجلوس مستخدم من قبل!', 'error');
        } else if (msg.includes('Username')) {
            showToast('اسم المستخدم مستخدم من قبل!', 'error');
        } else if (msg.includes('parentId')) {
            showToast('رقم بطاقة ولي الأمر مستخدم من قبل!', 'error');
        } else {
            showToast(`خطأ في إنشاء الحساب: ${msg}`, 'error');
        }
    }
});

// التحقق من توفر اسم المستخدم أثناء الكتابة
let usernameTimeout;
document.getElementById('username')?.addEventListener('input', async (e) => {
    const username = e.target.value.trim();
    const availabilitySpan = document.getElementById('username-availability');

    clearTimeout(usernameTimeout);

    if (username.length === 0) {
        availabilitySpan.style.display = 'none';
        return;
    }

    if (username.length < 3 || !/^[a-zA-Z0-9]{3,20}$/.test(username)) {
        availabilitySpan.textContent = 'يجب أن يكون 3-20 حرف (أحرف وأرقام فقط)';
        availabilitySpan.style.color = '#dc3545';
        availabilitySpan.style.display = 'block';
        return;
    }

    availabilitySpan.textContent = 'جاري التحقق...';
    availabilitySpan.style.color = '#ffc107';
    availabilitySpan.style.display = 'block';

    usernameTimeout = setTimeout(async () => {
        const isAvailable = await checkUsernameAvailability(username);
        availabilitySpan.textContent = isAvailable ? 'متاح!' : 'غير متاح!';
        availabilitySpan.style.color = isAvailable ? '#28a745' : '#dc3545';
    }, 500);
});
