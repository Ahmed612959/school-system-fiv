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
            tableBody.innerHTML = '<td><td colspan="2">لا توجد إشعارات حاليًا<\/td></td>';
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

    // ====================== المواد والدرجات ======================
    // المواد الأساسية (تدخل في المجموع)
    const subjectMaxGrades = {
        "اللغة العربية": 20,
        "اللغة الإنجليزية": 20,
        "علوم تطبيقية": 40,
        "طب باطنة": 20,
        "تمريض باطني جراحي": 24,
        "حاسب آلي": 20
    };
    
    // المواد الإضافية (خارج المجموع)
    const extraSubjects = {
        "الدين": 32
    };
    
    const TOTAL_POSSIBLE = 144; // المجموع الكلي بدون المواد الإضافية (20+20+40+20+24+20 = 144)
    
    const orderedSubjects = ["اللغة العربية", "اللغة الإنجليزية", "علوم تطبيقية", "طب باطنة", "تمريض باطني جراحي", "حاسب آلي"];
    const extraSubjectsList = ["الدين"];

    // حساب النسبة المئوية للطالب (بدون المواد الإضافية)
    function calculateStudentPercentage(student) {
        if (!student.subjects || student.subjects.length === 0) return 0;
        let totalEarned = 0;
        student.subjects.forEach(subject => {
            if (subjectMaxGrades[subject.name]) {
                totalEarned += subject.grade || 0;
            }
        });
        return (totalEarned / TOTAL_POSSIBLE) * 100;
    }
    
    // حساب المجموع الكلي للطالب (بدون المواد الإضافية)
    function calculateStudentTotal(student) {
        if (!student.subjects) return 0;
        let total = 0;
        student.subjects.forEach(subject => {
            if (subjectMaxGrades[subject.name]) {
                total += subject.grade || 0;
            }
        });
        return total;
    }
    
    // الحصول على درجة مادة إضافية (الدين)
    function getExtraSubjectGrade(student, subjectName) {
        const subject = student.subjects?.find(s => s.name === subjectName);
        return subject ? (subject.grade || 0) : 0;
    }

    // الحصول على قائمة المواد مع الدرجات (الأساسية فقط للرسم البياني)
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
        
        if (student.subjects && student.subjects.length > 0) {
            const percentage = calculateStudentPercentage(student);
            const total = calculateStudentTotal(student);
            const religionGrade = getExtraSubjectGrade(student, 'الدين');
            const subjectsWithGrades = getStudentSubjectsWithGrades(student);
            
            document.getElementById('student-percentage').innerHTML = `📊 نسبة نجاحك: <strong>${percentage.toFixed(1)}%</strong><br>
            <small>(المجموع: ${total} / ${TOTAL_POSSIBLE})</small>`;
            document.getElementById('class-average').innerHTML = `📈 متوسط الفصل: <strong>${calculateClassAverage().toFixed(1)}%</strong>`;
            
            // إضافة عرض مادة الدين بشكل منفصل
            const religionDiv = document.createElement('div');
            religionDiv.style.cssText = 'margin-top: 10px; padding: 8px; background: #f0f0f0; border-radius: 8px; text-align: center;';
            religionDiv.innerHTML = `📖 مادة الدين: <strong>${religionGrade} / 32</strong> (خارج المجموع)`;
            const statsDiv = document.querySelector('.stats');
            if (statsDiv && !document.getElementById('religionDisplay')) {
                const existing = document.getElementById('religionDisplay');
                if (existing) existing.remove();
                religionDiv.id = 'religionDisplay';
                statsDiv.appendChild(religionDiv);
            }
            
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
            resultBody.innerHTML = '<tr><td colspan="4">❌ لا توجد نتيجة بهذا الاسم ورقم الجلوس!<\/td><tr>';
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
        
        // حساب المجموع (بدون المواد الإضافية)
        let total = 0;
        const subjectGrades = [];
        
        orderedSubjects.forEach(subjName => {
            const subject = student.subjects.find(s => s.name === subjName);
            const grade = subject ? (subject.grade || 0) : 0;
            subjectGrades.push({ name: subjName, grade: grade, max: subjectMaxGrades[subjName] });
            total += grade;
        });
        
        // إضافة المواد الإضافية (الدين)
        extraSubjectsList.forEach(subjName => {
            const subject = student.subjects.find(s => s.name === subjName);
            const grade = subject ? (subject.grade || 0) : 0;
            subjectGrades.push({ name: `${subjName} (خارج المجموع)`, grade: grade, max: extraSubjects[subjName], isExtra: true });
        });
        
        const percentage = (total / TOTAL_POSSIBLE) * 100;
        let percentageClass = percentage >= 85 ? 'high-percentage' : (percentage >= 60 ? 'medium-percentage' : 'low-percentage');
        
        const labels = ['الاسم', 'رقم الجلوس', ...subjectGrades.map(s => s.name)];
        const values = [student.fullName, student.studentCode, ...subjectGrades.map(s => `${s.grade} / ${s.max}`)];
        
        resultBody.innerHTML = `<tr>
            <td>${labels.map((l,i) => i < labels.length-1 ? l+'<hr>' : l).join('')}<\/td>
            <td>${values.map((v,i) => i < values.length-1 ? v+'<hr>' : v).join('')}<\/td>
            <td>${total} / ${TOTAL_POSSIBLE}<\/td>
            <td class="${percentageClass}">${percentage.toFixed(1)}%<\/td>
        <\/tr>`;
        
        const studentVios = violations.filter(v => v.studentId === student.studentCode);
        violationsBody.innerHTML = studentVios.length ? studentVios.map(v => `<tr>
            <td>${v.type === 'warning' ? '⚠️ إنذار' : '🚫 مخالفة'}<\/td>
            <td>${v.reason}<\/td>
            <td>${v.penalty}<\/td>
            <td>${v.parentSummons ? '✅ نعم' : '❌ لا'}<\/td>
            <td>${v.date}<\/td>
        <\/tr>`).join('') : '<tr><td colspan="5">✅ لا توجد مخالفات مسجلة<\/td><\/tr>';
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

    // ====================== تفعيل الإشعارات (Push Notifications) ======================
    
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async function enableNotifications() {
        if (!('Notification' in window)) {
            showToast('⚠️ متصفحك لا يدعم الإشعارات', 'error');
            return;
        }
        
        if (!('PushManager' in window)) {
            showToast('⚠️ متصفحك لا يدعم الإشعارات المتقدمة', 'error');
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
            const registration = await navigator.serviceWorker.ready;
            console.log('✅ Service Worker is ready');
            
            const response = await fetch('/api/notifications/settings');
            const data = await response.json();
            
            if (!data.publicKey) {
                showToast('⚠️ لم يتم إعداد الإشعارات بعد، يرجى المحاولة لاحقاً', 'error');
                return;
            }
            
            const applicationServerKey = urlBase64ToUint8Array(data.publicKey);
            
            const existingSubscription = await registration.pushManager.getSubscription();
            if (existingSubscription) {
                await existingSubscription.unsubscribe();
                console.log('🗑️ Old subscription removed');
            }
            
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
            
            console.log('✅ New subscription created');
            
            const saveResponse = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription,
                    userId: user?.username || 'guest',
                    userType: user?.type || 'student'
                })
            });
            
            if (saveResponse.ok) {
                showToast('✅ تم تفعيل الإشعارات بنجاح! ستصل إليك التنبيهات', 'success');
                const btn = document.getElementById('enableNotificationsBtn');
                if (btn) btn.style.display = 'none';
            } else {
                const errorData = await saveResponse.json();
                showToast('❌ فشل الحفظ: ' + (errorData.error || 'خطأ غير معروف'), 'error');
            }
        } catch (error) {
            console.error('❌ Error in subscribeToPush:', error);
            showToast('❌ حدث خطأ في تفعيل الإشعارات: ' + error.message, 'error');
        }
    }

    const notifBtn = document.getElementById('enableNotificationsBtn');
    if (notifBtn) {
        notifBtn.addEventListener('click', enableNotifications);
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('✅ Service Worker registered:', reg))
            .catch(err => console.log('❌ SW failed:', err));
    }

    // ====================== تثبيت التطبيق (PWA) ======================
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) {
            installBtn.style.display = 'inline-block';
            installBtn.onclick = async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        console.log('✅ User accepted install');
                        showToast('✅ تم تثبيت التطبيق بنجاح!', 'success');
                    }
                    deferredPrompt = null;
                    installBtn.style.display = 'none';
                }
            };
        }
    });

    window.addEventListener('appinstalled', () => {
        console.log('✅ App installed successfully');
        showToast('🎉 شكراً لتثبيت التطبيق!', 'success');
    });

    // ====================== دالة عرض التنبيهات ======================
    function showToast(message, type = 'success') {
        const bg = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8';
        Toastify({ text: message, duration: 4000, gravity: "top", position: "right", backgroundColor: bg, style: { fontFamily: '"Tajawal", sans-serif', fontSize: '18px', direction: 'rtl', textAlign: 'right', borderRadius: '12px', padding: '16px 24px' } }).showToast();
    }

    // ====================== تنفيذ كل شيء ======================
    await loadInitialData();
    renderNavbar();
    renderWelcomeMessage();
    await renderNotifications();
    await renderDashboard();
});
