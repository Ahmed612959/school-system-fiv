document.addEventListener('DOMContentLoaded', function() {
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!loggedInUser) {
        showToast('يرجى تسجيل الدخول أولاً!', 'error');
        window.location.href = 'login.html';
        return;
    }

    // الرابط الرسمي لموقعك
    const BASE_URL = 'https://schoolx-five.vercel.app';

    // التحقق من وجود العناصر الأساسية
    const examAccess = document.getElementById('exam-access');
    const examContainer = document.getElementById('exam-container');
    const timerDisplay = document.getElementById('timer');
    if (!examAccess || !examContainer || !timerDisplay) {
        console.error('بعض العناصر مفقودة في DOM!');
        showToast('خطأ في تحميل الصفحة! أعد تحميل الصفحة.', 'error');
        return;
    }

    // الناف بار (موحد مع باقي الصفحات)
    const navBar = document.getElementById('nav-bar');
    const navItems = [
        { href: 'index.html', icon: 'fas fa-home', title: 'الرئيسية' },
        { href: 'Home.html', icon: 'fas fa-chart-line', title: 'النتائج' },
        { href: 'profile.html', icon: 'fas fa-user', title: 'الملف الشخصي' },
        { href: 'exams.html', icon: 'fas fa-book', title: 'الاختبارات' }
        
    ];
    if (loggedInUser.type === 'admin') {
        navItems.push({ href: 'admin.html', icon: 'fas fa-cogs', title: 'لوحة التحكم' });
    }
    navBar.innerHTML = navItems.map(item => 
        `<a href="${item.href}" title="${item.title}"><i class="${item.icon}"></i></a>`
    ).join('');

    let timerInterval = null;

    // جلب الاختبار بكود
    document.getElementById('exam-access-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const code = document.getElementById('exam-code').value.trim();
        if (!code) {
            showToast('أدخل كود الاختبار أولاً!', 'error');
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/api/exams/${encodeURIComponent(code)}`);
            if (!response.ok) {
                const err = await response.json();
                showToast(err.error || 'كود الاختبار غير صحيح!', 'error');
                return;
            }

            const exam = await response.json();

            // عرض عنوان الاختبار
            document.getElementById('exam-title').textContent = exam.name;

            // بناء الأسئلة ديناميكيًا
            const examForm = document.getElementById('exam-form');
            examForm.innerHTML = exam.questions.map((q, i) => `
                <div class="question">
                    <p><strong>سؤال ${i + 1}:</strong> ${q.text}</p>
                    ${q.type === 'multiple' ? q.options.map(opt => `
                        <label><input type="radio" name="q${i}" value="${opt}"> ${opt}</label><br>
                    `).join('') : ''}
                    ${q.type === 'truefalse' ? `
                        <label><input type="radio" name="q${i}" value="true"> صح</label><br>
                        <label><input type="radio" name="q${i}" value="false"> خطأ</label><br>
                    ` : ''}
                    ${q.type === 'essay' ? `
                        <textarea name="q${i}" rows="5" placeholder="اكتب إجابتك هنا..." required></textarea>
                    ` : ''}
                    ${q.type === 'list' ? `
                        <div class="list-answers">
                            ${[1,2,3,4,5].map(n => `
                                <div><span>${n}.</span><input type="text" name="q${i}-${n}" placeholder="الإجابة ${n}"></div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('');

            // إخفاء نموذج الكود وعرض الاختبار
            examAccess.style.display = 'none';
            examContainer.style.display = 'block';

            // تشغيل المؤقت
            startTimer(exam.duration * 60, code, exam);

        } catch (err) {
            console.error('خطأ في جلب الاختبار:', err);
            showToast('فشل الاتصال بالسيرفر! تأكد من الإنترنت.', 'error');
        }
    });

    // تشغيل المؤقت
    function startTimer(seconds, code, exam) {
        let timeLeft = seconds;
        timerDisplay.textContent = `الوقت المتبقي: ${formatTime(timeLeft)}`;

        timerInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = `الوقت المتبقي: ${formatTime(timeLeft)}`;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerDisplay.textContent = 'انتهى الوقت!';
                submitExam(code, exam);
            }
        }, 1000);
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' + s : s}`;
    }

    // إرسال الإجابات وتصحيح الاختبار
    async function submitExam(code, exam) {
        clearInterval(timerInterval);
        const form = document.getElementById('exam-form');
        const formData = new FormData(form);
        const answers = [];

        exam.questions.forEach((q, i) => {
            if (q.type === 'multiple' || q.type === 'truefalse') {
                answers.push({ questionIndex: i, answer: formData.get(`q${i}`) || '' });
            } else if (q.type === 'essay') {
                answers.push({ questionIndex: i, answer: formData.get(`q${i}`) || '' });
            } else if (q.type === 'list') {
                const listAns = [1,2,3,4,5].map(n => formData.get(`q${i}-${n}`) || '').filter(a => a);
                answers.push({ questionIndex: i, answers: listAns });
            }
        });

        // تصحيح تلقائي
        let correct = 0;
        exam.questions.forEach((q, i) => {
            const userAns = answers.find(a => a.questionIndex === i);
            if (!userAns) return;

            if (q.type === 'multiple' || q.type === 'truefalse') {
                if (userAns.answer === q.correctAnswer) correct++;
            } else if (q.type === 'essay' || q.type === 'list') {
                const userWords = (q.type === 'list' ? userAns.answers : [userAns.answer])
                    .join(' ').toLowerCase().split(/\s+/);
                const correctWords = (q.type === 'list' ? q.correctAnswers : [q.correctAnswer])
                    .join(' ').toLowerCase().split(/\s+/);
                const matchRatio = userWords.filter(w => correctWords.includes(w)).length / correctWords.length;
                if (matchRatio >= 0.7) correct++;
            }
        });

        const percentage = (correct / exam.questions.length) * 100;

        try {
            await fetch(`${BASE_URL}/api/exams/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    examCode: code,
                    studentId: loggedInUser.username,
                    score: percentage
                })
            });

            showToast(`مبروك! نتيجتك: ${percentage.toFixed(1)}%`, 'success');
        } catch (err) {
            showToast('تم حفظ النتيجة محليًا (لا يوجد اتصال)', 'info');
            console.log('النتيجة المحلية:', { code, student: loggedInUser.username, percentage });
        }

        // إعادة الصفحة لحالتها الأولية
        examContainer.style.display = 'none';
        examAccess.style.display = 'block';
        document.getElementById('exam-code').value = '';
    }

    // زر التسليم اليدوي
    document.getElementById('submit-exam')?.addEventListener('click', async () => {
        const code = document.getElementById('exam-code').value.trim();
        if (!code) return showToast('أدخل الكود أولاً!', 'error');

        const res = await fetch(`${BASE_URL}/api/exams/${encodeURIComponent(code)}`);
        if (!res.ok) return showToast('كود غير صحيح!', 'error');
        const exam = await res.json();
        submitExam(code, exam);
    });

    // Toast موحد وجميل
    function showToast(message, type = 'success') {
        const bg = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8';
        Toastify({
            text: message,
            duration: 5000,
            gravity: "top",
            position: "right",
            backgroundColor: bg,
            stopOnFocus: true,
            style: {
                fontFamily: '"Tajawal", sans-serif',
                fontSize: "18px",
                padding: "20px 30px",
                borderRadius: "12px",
                direction: "rtl",
                textAlign: "right",
                boxShadow: "0 8px 25px rgba(0,0,0,0.3)"
            }
        }).showToast();
    }
}); 
