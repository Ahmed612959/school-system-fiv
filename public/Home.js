document.addEventListener('DOMContentLoaded', async function() {
    // الرابط حسب البيئة (محلي أو منشور)
    const BASE_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000' 
        : 'https://schoolx-five.vercel.app';

    console.log('🌐 BASE_URL:', BASE_URL);

    // دالة جلب البيانات موحدة
    async function getFromServer(endpoint) {
        try {
            let cleanEndpoint = endpoint.split('/api/').pop() || endpoint;
            cleanEndpoint = cleanEndpoint.replace(/^\/+/, '');
            const url = `${BASE_URL}/api/${cleanEndpoint}`;

            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`خطأ ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log(`تم جلب البيانات من: ${url} →`, data.length || data, 'عنصر');
            return data || [];
        } catch (error) {
            console.error('خطأ في الاتصال بالسيرفر:', error);
            showToast('فشل الاتصال بالسيرفر! تأكد من الإنترنت أو تواصل مع الإدارة.', 'error');
            return [];
        }
    }

    let students = [];
    let violations = [];

    async function loadInitialData() {
        students = await getFromServer('/api/students');
        violations = await getFromServer('/api/violations');
        console.log('Loaded students:', students.map(s => ({ name: s.fullName, code: s.studentCode })));
    }

    async function renderNotifications() {
        const notifications = await getFromServer('/api/notifications');
        const tableBody = document.getElementById('notifications-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        if (notifications.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="2">لا توجد إشعارات حاليًا</td></td>';
            return;
        }

        notifications.forEach(n => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${n.text || 'إشعار بدون نص'}</td>
                <td>${n.date || 'غير محدد'}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    function renderNavbar() {
        const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        const navBar = document.getElementById('nav-bar');
        if (!navBar) return;

        const links = [
            { href: 'index.html',      icon: 'fa-solid fa-house',           title: 'الرئيسية' },
            { href: 'Home.html',       icon: 'fa-solid fa-chart-simple',    title: 'النتائج' },
            { href: 'profile.html',    icon: 'fa-solid fa-user',            title: 'الملف الشخصي' },
            { href: 'search-monthly.html', icon: 'fa-solid fa-magnifying-glass', title: 'نتيجة الشهري' },
            { href: 'First-Gards.html', icon: 'fa-solid fa-graduation-cap', title: 'نتيجة الصف الاول' },
            { href: 'exams.html',      icon: 'fa-solid fa-book-open',       title: 'الاختبارات' },
            { href: 'developer.html',  icon: 'fa-solid fa-microchip',       title: 'عن المطور' }
        ];

        if (loggedInUser?.type === 'admin') {
            links.push({ href: 'admin.html', icon: 'fas fa-cogs', title: 'لوحة التحكم' });
        }

        navBar.innerHTML = links.map(l => 
            `<a href="${l.href}" title="${l.title}"><i class="${l.icon}"></i></a>`
        ).join('');
    }

    // ====================== المواد والدرجات النهائية ======================
    const subjectMaxGrades = {
        "اللغة العربية": 20,
        "اللغة الإنجليزية": 20,
        "علوم تطبيقية": 40,
        "طب باطنة": 20,
        "تمريض باطني جراحي": 24,
        "حاسب آلي": 20,
        "الدين": 30
    };
    const TOTAL_POSSIBLE = 174;

    // ترتيب المواد للعرض
    const orderedSubjects = [
        "اللغة العربية",
        "اللغة الإنجليزية",
        "علوم تطبيقية",
        "طب باطنة",
        "تمريض باطني جراحي",
        "حاسب آلي",
        "الدين"
    ];

    // حساب النسبة المئوية للطالب
    function calculateStudentPercentage(student) {
        if (!student.subjects || student.subjects.length === 0) return 0;
        
        let totalEarned = 0;
        
        student.subjects.forEach(subject => {
            totalEarned += subject.grade || 0;
        });
        
        return (totalEarned / TOTAL_POSSIBLE) * 100;
    }
    
    // حساب المجموع الكلي للطالب
    function calculateStudentTotal(student) {
        if (!student.subjects) return 0;
        
        let total = 0;
        student.subjects.forEach(subject => {
            total += subject.grade || 0;
        });
        return total;
    }

    // الحصول على قائمة المواد مع الدرجات
    function getStudentSubjectsWithGrades(student) {
        const result = [];
        
        orderedSubjects.forEach(subjName => {
            const subject = student.subjects?.find(s => s.name === subjName);
            const grade = subject ? (subject.grade || 0) : 0;
            result.push({ name: subjName, grade: grade, max: subjectMaxGrades[subjName] });
        });
        
        return result;
    }

    function renderDashboard() {
        const user = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        const dashboard = document.getElementById('dashboard');
        if (!dashboard || !user || user.type !== 'student') {
            if (dashboard) dashboard.style.display = 'none';
            return;
        }

        const student = students.find(s => s.username === user.username);
        if (!student || !student.subjects?.length) {
            if (dashboard) dashboard.style.display = 'none';
            return;
        }

        dashboard.style.display = 'block';

        const percentage = calculateStudentPercentage(student);
        const total = calculateStudentTotal(student);
        const subjectsWithGrades = getStudentSubjectsWithGrades(student);

        document.getElementById('student-percentage').innerHTML = `📊 نسبة نجاحك: <strong>${percentage.toFixed(1)}%</strong><br>
        <small style="font-size: 12px;">(المجموع: ${total} / ${TOTAL_POSSIBLE})</small>`;
        document.getElementById('class-average').innerHTML = `📈 متوسط الفصل: <strong>${calculateClassAverage().toFixed(1)}%</strong>`;

        const ctx = document.getElementById('gradesChart')?.getContext('2d');
        if (ctx && window.Chart) {
            if (window.gradesChart) window.gradesChart.destroy();
            window.gradesChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: subjectsWithGrades.map(s => s.name),
                    datasets: [{
                        label: 'درجاتك',
                        data: subjectsWithGrades.map(s => s.grade),
                        backgroundColor: 'rgba(212, 175, 55, 0.8)',
                        borderColor: '#d4af37',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            max: 100,
                            title: { display: true, text: 'الدرجة' }
                        } 
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    }

    function calculateClassAverage() {
        const studentsWithGrades = students.filter(s => s.subjects && s.subjects.length > 0);
        if (!studentsWithGrades.length) return 0;
        
        const percentages = studentsWithGrades.map(s => calculateStudentPercentage(s));
        const sum = percentages.reduce((a, b) => a + b, 0);
        return sum / percentages.length;
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

        const student = students.find(s => 
            s.fullName.includes(name) && s.studentCode === studentCode
        );
        
        const resultBody = document.getElementById('result-table-body');
        const violationsBody = document.getElementById('violations-table-body');

        if (student) {
            renderStudentResult(student, resultBody, violationsBody);
            showToast('✅ تم العثور على الطالب بنجاح!', 'success');
        } else {
            resultBody.innerHTML = '<tr><td colspan="4">❌ لا توجد نتيجة بهذا الاسم ورقم الجلوس!</td></tr>';
            violationsBody.innerHTML = '<tr><td colspan="5">❌ لا توجد نتيجة!</td></tr>';
            showToast('❌ الطالب غير موجود! تأكد من رقم الجلوس', 'error');
        }
    });

    function renderStudentResult(student, resultBody, violationsBody) {
        if (!student.subjects || student.subjects.length === 0) {
            resultBody.innerHTML = '<tr><td colspan="4">📭 لا توجد درجات مسجلة لهذا الطالب</td></tr>';
            violationsBody.innerHTML = '<tr><td colspan="5">✅ لا توجد مخالفات</td></tr>';
            return;
        }

        const total = calculateStudentTotal(student);
        const percentage = calculateStudentPercentage(student);
        
        let percentageClass = '';
        if (percentage >= 85) percentageClass = 'high-percentage';
        else if (percentage >= 60) percentageClass = 'medium-percentage';
        else percentageClass = 'low-percentage';

        // الحصول على المواد مع الدرجات
        const subjectsWithGrades = getStudentSubjectsWithGrades(student);
        
        const labels = ['الاسم', 'رقم الجلوس', ...subjectsWithGrades.map(s => s.name)];
        const values = [student.fullName, student.studentCode, ...subjectsWithGrades.map(s => `${s.grade} / ${s.max}`)];

        resultBody.innerHTML = `
            <tr>
                <td>${labels.map((l,i) => i < labels.length-1 ? l+'<hr>' : l).join('')}</td>
                <td>${values.map((v,i) => i < values.length-1 ? v+'<hr>' : v).join('')}</td>
                <td>${total} / ${TOTAL_POSSIBLE}</td>
                <td class="${percentageClass}">${percentage.toFixed(1)}%</td>
            </tr>
        `;

        // المخالفات الخاصة بالطالب
        const studentVios = violations.filter(v => v.studentId === student.studentCode);
        
        if (studentVios.length > 0) {
            violationsBody.innerHTML = studentVios.map(v => `
                <tr>
                    <td>${v.type === 'warning' ? '⚠️ إنذار' : '🚫 مخالفة'}</td>
                    <td>${v.reason}</td>
                    <td>${v.penalty}</td>
                    <td>${v.parentSummons ? '✅ نعم' : '❌ لا'}</td>
                    <td>${v.date}</td>
                </tr>
            `).join('');
        } else {
            violationsBody.innerHTML = '<tr><td colspan="5">✅ لا توجد مخالفات مسجلة</td></tr>';
        }
    }

    function renderWelcomeMessage() {
        const welcome = document.querySelector('.welcome-message');
        const user = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
        if (!welcome) return;

        if (user) {
            const name = user.fullName || user.username;
            const msg = user.type === 'admin' 
                ? `👋 أهلًا يا قائد العمليات، ${name}! جاهز للانطلاق؟ 🛠️`
                : `🎉 مرحبًا يا نجم، ${name}! نتايجك في انتظارك! 📚`;
            welcome.textContent = msg;
            showToast(msg, 'success');
        } else {
            welcome.textContent = '👋 مرحبًا بك! سجل الدخول لرؤية نتائجك';
        }
    }

    function showToast(message, type = 'success') {
        const bg = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8';
        Toastify({
            text: message,
            duration: 4000,
            gravity: "top",
            position: "right",
            backgroundColor: bg,
            style: { 
                fontFamily: '"Tajawal", sans-serif', 
                fontSize: '18px', 
                direction: 'rtl', 
                textAlign: 'right',
                borderRadius: '12px',
                padding: '16px 24px'
            }
        }).showToast();
    }

    // تنفيذ كل حاجة بالترتيب الصحيح
    await loadInitialData();
    renderNavbar();
    renderWelcomeMessage();
    await renderNotifications();
    renderDashboard();
});
