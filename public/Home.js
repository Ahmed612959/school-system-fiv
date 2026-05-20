document.addEventListener('DOMContentLoaded', async function() {
    const BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://school-system-fiv.vercel.app';
    console.log('🌐 BASE_URL:', BASE_URL);

    async function getFromServer(endpoint) {
        try {
            let cleanEndpoint = endpoint.split('/api/').pop() || endpoint;
            cleanEndpoint = cleanEndpoint.replace(/^\/+/, '');
            const url = `${BASE_URL}/api/${cleanEndpoint}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`خطأ ${response.status}`);
            const data = await response.json();
            return data || [];
        } catch (error) {
            console.error('خطأ في الاتصال بالسيرفر:', error);
            showToast('فشل الاتصال بالسيرفر!', 'error');
            return [];
        }
    }

    let students = [];
    let violations = [];

    async function loadInitialData() {
        students = await getFromServer('/api/students');
        violations = await getFromServer('/api/violations');
        console.log('Loaded students:', students.length);
    }

    async function renderNotifications() {
        const notifications = await getFromServer('/api/notifications');
        const tableBody = document.getElementById('notifications-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (notifications.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="2">لا توجد إشعارات حاليًا<\/td></tr>';
            return;
        }
        notifications.forEach(n => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${n.text || 'إشعار بدون نص'}<\/td><td>${n.date || 'غير محدد'}<\/td>`;
            tableBody.appendChild(row);
        });
    }

    function renderNavbar() {
        const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        const navBar = document.getElementById('nav-bar');
        if (!navBar) return;
        const links = [
            { href: 'index.html', icon: 'fa-solid fa-house', title: 'الرئيسية' },
            { href: 'Home.html', icon: 'fa-solid fa-chart-simple', title: 'النتائج' },
            { href: 'profile.html', icon: 'fa-solid fa-user', title: 'الملف الشخصي' },
            { href: 'search-monthly.html', icon: 'fa-solid fa-magnifying-glass', title: 'نتيجة الشهري' },
            { href: 'First-Gards.html', icon: 'fa-solid fa-graduation-cap', title: 'نتيجة الصف الاول' },
            { href: 'exams.html', icon: 'fa-solid fa-book-open', title: 'الاختبارات' },
            { href: 'developer.html', icon: 'fa-solid fa-microchip', title: 'عن المطور' }
        ];
        if (loggedInUser?.type === 'admin') links.push({ href: 'admin.html', icon: 'fas fa-cogs', title: 'لوحة التحكم' });
        navBar.innerHTML = links.map(l => `<a href="${l.href}" title="${l.title}"><i class="${l.icon}"><\/i></a>`).join('');
    }

    const subjectMaxGrades = { "اللغة العربية": 20, "اللغة الإنجليزية": 20, "علوم تطبيقية": 40, "طب باطنة": 20, "تمريض باطني جراحي": 24, "حاسب آلي": 20, "الدين": 30 };
    const TOTAL_POSSIBLE = 174;
    const orderedSubjects = ["اللغة العربية", "اللغة الإنجليزية", "علوم تطبيقية", "طب باطنة", "تمريض باطني جراحي", "حاسب آلي", "الدين"];

    function calculateStudentPercentage(student) {
        if (!student.subjects || student.subjects.length === 0) return 0;
        let totalEarned = student.subjects.reduce((sum, s) => sum + (s.grade || 0), 0);
        return (totalEarned / TOTAL_POSSIBLE) * 100;
    }
    
    function calculateStudentTotal(student) {
        if (!student.subjects) return 0;
        return student.subjects.reduce((sum, s) => sum + (s.grade || 0), 0);
    }

    function getStudentSubjectsWithGrades(student) {
        const result = [];
        orderedSubjects.forEach(subjName => {
            const subject = student.subjects?.find(s => s.name === subjName);
            result.push({ name: subjName, grade: subject ? (subject.grade || 0) : 0, max: subjectMaxGrades[subjName] });
        });
        return result;
    }

    function calculateClassAverage() {
        const studentsWithGrades = students.filter(s => s.subjects && s.subjects.length > 0);
        if (!studentsWithGrades.length) return 0;
        const percentages = studentsWithGrades.map(s => calculateStudentPercentage(s));
        return percentages.reduce((a, b) => a + b, 0) / percentages.length;
    }

    // ====================== إحصائيات الحضور والغياب ======================
    let attendanceStats = null;

    async function fetchAttendanceStats(studentCode) {
        try {
            const response = await fetch(`${BASE_URL}/api/attendance/student/${studentCode}?t=${Date.now()}`);
            if (response.ok) {
                const attendanceRecords = await response.json();
                if (attendanceRecords.length === 0) {
                    attendanceStats = null;
                    return null;
                }
                const present = attendanceRecords.filter(a => a.status === 'present').length;
                const absent = attendanceRecords.filter(a => a.status === 'absent').length;
                const late = attendanceRecords.filter(a => a.status === 'late').length;
                const total = attendanceRecords.length;
                const percentage = total > 0 ? (present / total) * 100 : 0;
                const lastPresent = attendanceRecords.filter(a => a.status === 'present').sort((a,b) => new Date(b.date) - new Date(a.date))[0];
                const lastAbsent = attendanceRecords.filter(a => a.status === 'absent').sort((a,b) => new Date(b.date) - new Date(a.date))[0];
                
                attendanceStats = {
                    present, absent, late, total, percentage: percentage.toFixed(1),
                    lastPresentDate: lastPresent ? formatDate(lastPresent.date) : null,
                    lastAbsentDate: lastAbsent ? formatDate(lastAbsent.date) : null
                };
                return attendanceStats;
            }
            return null;
        } catch (error) { console.error('Error fetching attendance stats:', error); return null; }
    }

    function formatDate(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
    }

    function renderAttendanceStats() {
        const section = document.getElementById('attendanceStatsSection');
        if (!section) return;
        const user = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        if (!user || user.type !== 'student') {
            section.style.display = 'none';
            return;
        }
        if (!attendanceStats) {
            section.style.display = 'block';
            document.getElementById('noAttendanceMessage').style.display = 'block';
            const grid = document.querySelector('.attendance-stats-grid');
            const dates = document.querySelector('.attendance-dates');
            if (grid) grid.style.display = 'none';
            if (dates) dates.style.display = 'none';
            return;
        }
        section.style.display = 'block';
        document.getElementById('noAttendanceMessage').style.display = 'none';
        const grid = document.querySelector('.attendance-stats-grid');
        const dates = document.querySelector('.attendance-dates');
        if (grid) grid.style.display = 'grid';
        if (dates) dates.style.display = 'flex';
        
        document.getElementById('presentCount').textContent = attendanceStats.present;
        document.getElementById('absentCount').textContent = attendanceStats.absent;
        document.getElementById('lateCount').textContent = attendanceStats.late;
        document.getElementById('attendancePercentage').textContent = attendanceStats.percentage + '%';
        document.getElementById('lastPresentDate').innerHTML = attendanceStats.lastPresentDate || 'لم يتم تسجيل بعد';
        document.getElementById('lastAbsentDate').innerHTML = attendanceStats.lastAbsentDate || 'لم يتم تسجيل بعد';
    }

    // ====================== دالة renderDashboard ======================
    async function renderDashboard() {
        const user = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        const dashboard = document.getElementById('dashboard');
        if (!dashboard || !user || user.type !== 'student') {
            if (dashboard) dashboard.style.display = 'none';
            const section = document.getElementById('attendanceStatsSection');
            if (section) section.style.display = 'none';
            return;
        }
        const student = students.find(s => s.username === user.username);
        if (!student) {
            if (dashboard) dashboard.style.display = 'none';
            return;
        }
        dashboard.style.display = 'block';
        
        // عرض الدرجات (حتى لو بدون مواد)
        if (student.subjects && student.subjects.length > 0) {
            const percentage = calculateStudentPercentage(student);
            const total = calculateStudentTotal(student);
            const subjectsWithGrades = getStudentSubjectsWithGrades(student);
            document.getElementById('student-percentage').innerHTML = `📊 نسبة نجاحك: <strong>${percentage.toFixed(1)}%</strong><br><small>(المجموع: ${total} / ${TOTAL_POSSIBLE})</small>`;
            document.getElementById('class-average').innerHTML = `📈 متوسط الفصل: <strong>${calculateClassAverage().toFixed(1)}%</strong>`;
            
            const ctx = document.getElementById('gradesChart')?.getContext('2d');
            if (ctx && window.Chart) {
                if (window.gradesChart) window.gradesChart.destroy();
                window.gradesChart = new Chart(ctx, {
                    type: 'bar',
                    data: { labels: subjectsWithGrades.map(s => s.name), datasets: [{ label: 'درجاتك', data: subjectsWithGrades.map(s => s.grade), backgroundColor: 'rgba(212, 175, 55, 0.8)', borderColor: '#d4af37', borderWidth: 2 }] },
                    options: { responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } }
                });
            }
        } else {
            document.getElementById('student-percentage').innerHTML = `📊 لا توجد درجات مسجلة حتى الآن`;
            document.getElementById('class-average').innerHTML = `📈 --`;
        }
        
        // جلب إحصائيات الحضور (مهم جداً - يظهر حتى بدون درجات)
        if (student && student.studentCode) {
            await fetchAttendanceStats(student.studentCode);
            renderAttendanceStats();
        }
    }

    // البحث عن الطالب
    document.getElementById('search-form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('search-name').value.trim();
        const studentCode = document.getElementById('search-id').value.trim();
        if (!name || !studentCode) {
            showToast('⚠️ يرجى إدخال الاسم ورقم الجلوس معًا!', 'error');
            return;
        }
        const student = students.find(s => s.fullName.includes(name) && s.studentCode === studentCode);
        const resultBody = document.getElementById('result-table-body');
        const violationsBody = document.getElementById('violations-table-body');
        if (student) {
            renderStudentResult(student, resultBody, violationsBody);
            showToast('✅ تم العثور على الطالب بنجاح!', 'success');
        } else {
            resultBody.innerHTML = '<tr><td colspan="4">❌ لا توجد نتيجة بهذا الاسم ورقم الجلوس!<\/td></tr>';
            violationsBody.innerHTML = '<td><td colspan="5">❌ لا توجد نتيجة!<\/td></tr>';
            showToast('❌ الطالب غير موجود! تأكد من رقم الجلوس', 'error');
        }
    });

    function renderStudentResult(student, resultBody, violationsBody) {
        if (!student.subjects || student.subjects.length === 0) {
            resultBody.innerHTML = '<td><td colspan="4">📭 لا توجد درجات مسجلة لهذا الطالب<\/td></tr>';
            violationsBody.innerHTML = '<td><td colspan="5">✅ لا توجد مخالفات<\/td></tr>';
            return;
        }
        const total = calculateStudentTotal(student);
        const percentage = calculateStudentPercentage(student);
        let percentageClass = percentage >= 85 ? 'high-percentage' : (percentage >= 60 ? 'medium-percentage' : 'low-percentage');
        const subjectsWithGrades = getStudentSubjectsWithGrades(student);
        const labels = ['الاسم', 'رقم الجلوس', ...subjectsWithGrades.map(s => s.name)];
        const values = [student.fullName, student.studentCode, ...subjectsWithGrades.map(s => `${s.grade} / ${s.max}`)];
        resultBody.innerHTML = `<tr><td>${labels.map((l,i) => i < labels.length-1 ? l+'<hr>' : l).join('')}<\/td><td>${values.map((v,i) => i < values.length-1 ? v+'<hr>' : v).join('')}<\/td><td>${total} / ${TOTAL_POSSIBLE}<\/td><td class="${percentageClass}">${percentage.toFixed(1)}%<\/td><\/tr>`;
        const studentVios = violations.filter(v => v.studentId === student.studentCode);
        violationsBody.innerHTML = studentVios.length ? studentVios.map(v => `<tr><td>${v.type === 'warning' ? '⚠️ إنذار' : '🚫 مخالفة'}<\/td><td>${v.reason}<\/td><td>${v.penalty}<\/td><td>${v.parentSummons ? '✅ نعم' : '❌ لا'}<\/td><td>${v.date}<\/td><\/tr>`).join('') : '<tr><td colspan="5">✅ لا توجد مخالفات مسجلة<\/td><\/tr>';
    }

    function renderWelcomeMessage() {
        const welcome = document.querySelector('.welcome-message');
        const user = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        if (!welcome) return;
        if (user) {
            const name = user.fullName || user.username;
            welcome.textContent = user.type === 'admin' ? `👋 أهلًا يا قائد العمليات، ${name}! 🛠️` : `🎉 مرحبًا يا نجم، ${name}! نتايجك في انتظارك! 📚`;
            showToast(welcome.textContent, 'success');
        } else {
            welcome.textContent = '👋 مرحبًا بك! سجل الدخول لرؤية نتائجك';
        }
    }



    // ====================== تفعيل الإشعارات ======================
async function enableNotifications() {
    if (!('Notification' in window)) {
        showToast('⚠️ متصفحك لا يدعم الإشعارات', 'error');
        return;
    }
    
    if (Notification.permission === 'granted') {
        await subscribeToPush();
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            await subscribeToPush();
        } else {
            showToast('❌ تم رفض الإشعارات', 'error');
        }
    } else {
        showToast('❌ الإشعارات مرفوضة، يرجى تفعيلها من إعدادات المتصرب', 'error');
    }
}

async function subscribeToPush() {
    try {
        const user = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        
        const registration = await navigator.serviceWorker.register('/sw.js');
        const response = await fetch('/api/notifications/settings');
        const data = await response.json();
        
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: data.publicKey
        });
        
        await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription: subscription,
                userId: user?.username || 'guest',
                userType: user?.type || 'student'
            })
        });
        
        showToast('✅ تم تفعيل الإشعارات بنجاح!', 'success');
        const btn = document.getElementById('enableNotificationsBtn');
        if (btn) btn.style.display = 'none';
    } catch (error) {
        console.error('Error:', error);
        showToast('❌ حدث خطأ في تفعيل الإشعارات', 'error');
    }
}

// زر تفعيل الإشعارات
const notifBtn = document.getElementById('enableNotificationsBtn');
if (notifBtn) {
    notifBtn.addEventListener('click', enableNotifications);
}

// تسجيل Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW failed:', err));
}



    

    function showToast(message, type = 'success') {
        const bg = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8';
        Toastify({ text: message, duration: 4000, gravity: "top", position: "right", backgroundColor: bg, style: { fontFamily: '"Tajawal", sans-serif', fontSize: '18px', direction: 'rtl', textAlign: 'right', borderRadius: '12px', padding: '16px 24px' } }).showToast();
    }

    await loadInitialData();
    renderNavbar();
    renderWelcomeMessage();
    await renderNotifications();
    await renderDashboard();
});
