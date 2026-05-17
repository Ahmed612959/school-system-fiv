document.addEventListener('DOMContentLoaded', function() {
    async function getFromServer(endpoint) {
    try {
        let cleanEndpoint = endpoint.split('/api/').pop() || endpoint;
        cleanEndpoint = cleanEndpoint.replace(/^\/+/, '');
        const response = await fetch(`/api/${cleanEndpoint}`);
        if (!response.ok) throw new Error(`خطأ ${response.status}`);
        const data = await response.json();
        console.log(`Data loaded from /api/${cleanEndpoint}:`, data.length, 'items');
        return data || [];
    } catch (error) {
        console.error(`Error fetching from ${endpoint}:`, error);
        showToast('خطأ في جلب البيانات من الخادم!', 'error');
        return [];
    }
}

    async function saveToServer(endpoint, data, method = 'POST', id = null) {
    try {
        // الحل السحري والأخير: نشيل كل حاجة قبل آخر /api/
        let cleanEndpoint = endpoint.split('/api/').pop() || endpoint;
        cleanEndpoint = cleanEndpoint.replace(/^\/+/, ''); // نشيل أي / من البداية

        const url = id 
            ? `/api/${cleanEndpoint}/${id}` 
            : `/api/${cleanEndpoint}`;

        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };

        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`خطأ ${response.status}: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error saving to ${endpoint}:`, error);
        showToast(`خطأ في حفظ البيانات: ${error.message}`, 'error');
        throw error;
    }
}

    function renderAdminWelcomeMessage() {
        const welcomeMessage = document.querySelector('.admin-welcome-message');
        const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        if (welcomeMessage && loggedInUser.username) {
            const userName = loggedInUser.fullName || loggedInUser.username;
            let message = `أهلًا بك يا قائد الفريق، ${userName}! مستعد لإدارة المعهد بكفاءة؟ 🛠️`;
            welcomeMessage.textContent = message;
            showToast(message, 'success');
        } else if (welcomeMessage) {
            welcomeMessage.textContent = 'يرجى تسجيل الدخول كأدمن للوصول إلى لوحة التحكم! 🔐';
            showToast('يرجى تسجيل الدخول أولاً!', 'info');
        }
    }

    function showToast(message, type = 'success') {
        let background;
        switch (type) {
            case 'success':
                background = 'linear-gradient(135deg, #28a745, #218838)';
                break;
            case 'error':
                background = 'linear-gradient(135deg, #dc3545, #c82333)';
                break;
            case 'info':
                background = 'linear-gradient(135deg, #17a2b8, #117a8b)';
                break;
            default:
                background = '#333';
        }
        Toastify({
            text: message,
            duration: 4000,
            gravity: 'top',
            position: 'right',
            style: {
                background: background,
                fontSize: '18px',
                fontFamily: '"Tajawal", "Arial", sans-serif',
                padding: '20px 30px',
                borderRadius: '10px',
                direction: 'rtl',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                color: '#fff',
                maxWidth: '400px',
                textAlign: 'right',
            },
            stopOnFocus: true,
        }).showToast();
    }

    let students = [];
    let admins = [];
    let notifications = [];
    let violations = [];

    async function loadInitialData() {
        admins = await getFromServer('/api/admins');
        students = await getFromServer('/api/students');
        notifications = await getFromServer('/api/notifications');
        violations = await getFromServer('/api/violations');
        renderAdmins();
        renderResults();
        renderStats();
        renderNotifications();
        renderViolations();
    }

    function renderAdmins() {
        const tableBody = document.getElementById('users-table-body');
        if (tableBody) {
            tableBody.innerHTML = '';
            admins.forEach(admin => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${admin.fullName}</td>
                    <td>${admin.username}</td>
                    <td>
                        <button class="delete-btn" onclick="deleteAdmin('${admin.username}')"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }
    }

    document.getElementById('add-user-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        const fullName = document.getElementById('admin-name').value.trim();
        const username = document.getElementById('admin-username').value.trim();
        const password = document.getElementById('admin-password').value.trim();

        if (!fullName || !username || !password) {
            showToast('يرجى إدخال الاسم الكامل، اسم المستخدم، وكلمة المرور!', 'error');
            return;
        }

        const response = await saveToServer('/api/admins', { fullName, username, password });
        if (response) {
            admins = await getFromServer('/api/admins');
            renderAdmins();
            showToast(`تم إضافة الأدمن بنجاح!\nاسم المستخدم: ${username}\nكلمة المرور: ${password}`, 'success');
            this.reset();
        } else {
            showToast('فشل إضافة الأدمن! تحقق من اسم المستخدم.', 'error');
        }
    });

    window.deleteAdmin = async function(username) {
        if (confirm('هل أنت متأكد من حذف هذا الأدمن؟')) {
            const response = await saveToServer(`/api/admins/${username}`, {}, 'DELETE');
            if (response) {
                admins = await getFromServer('/api/admins');
                renderAdmins();
                showToast('تم حذف الأدمن بنجاح.', 'success');
            } else {
                showToast('لا يمكن حذف آخر أدمن أو حدث خطأ!', 'error');
            }
        }
    };

  function renderResults(filter = '') {
    const tableBody = document.getElementById('results-table-body');
    if (tableBody) {
        tableBody.innerHTML = '';
        
        // المواد المطلوب عرضها (حسب المواد الجديدة)
        const requiredSubjects = [
            "اللغة العربية",
            "اللغة الإنجليزية", 
            "علوم تطبيقية",
            "طب باطنة",
            "تمريض باطني جراحي",
            "حاسب آلي",
            "الدين"
        ];
        
        // الدرجات النهائية لكل مادة
        const subjectMax = {
            "اللغة العربية": 20,
            "اللغة الإنجليزية": 20,
            "علوم تطبيقية": 40,
            "طب باطنة": 20,
            "تمريض باطني جراحي": 24,
            "حاسب آلي": 20,
            "الدين": 30
        };
        
        const TOTAL_POSSIBLE = 174;
        
        // تصفية: عرض الطلاب اللي عندهم درجات فقط
        const studentsWithGrades = students.filter(student => 
            student.subjects && student.subjects.length > 0
        );
        
        const filteredStudents = studentsWithGrades.filter(student => 
            student.fullName.toLowerCase().includes(filter.toLowerCase()) ||
            (student.studentCode && student.studentCode.toLowerCase().includes(filter.toLowerCase()))
        );
        
        filteredStudents.forEach(student => {
            // حساب المجموع حسب المواد الجديدة
            let total = 0;
            const subjectGrades = [];
            
            requiredSubjects.forEach(subjName => {
                const subject = student.subjects.find(s => s.name === subjName);
                const grade = subject ? (subject.grade || 0) : 0;
                subjectGrades.push({ name: subjName, grade: grade });
                total += grade;
            });
            
            const percentage = (total / TOTAL_POSSIBLE) * 100;
            let percentageClass = '';
            if (percentage >= 85) percentageClass = 'high-percentage';
            else if (percentage >= 60) percentageClass = 'medium-percentage';
            else percentageClass = 'low-percentage';
            
            const labels = ['اسم الطالب', 'رقم الجلوس', ...subjectGrades.map(s => s.name)];
            const values = [student.fullName, student.studentCode, ...subjectGrades.map(s => s.grade || 0)];
            
            const labelsWithSeparators = labels.map((label, index) => 
                index < labels.length - 1 ? `${label}<hr class="table-separator">` : label
            ).join('');
            const valuesWithSeparators = values.map((value, index) => 
                index < values.length - 1 ? `${value}<hr class="table-separator">` : value
            ).join('');
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${labelsWithSeparators}</td>
                <td>${valuesWithSeparators}</td>
                <td>${total} / ${TOTAL_POSSIBLE}</td>
                <td class="${percentageClass}">${percentage.toFixed(1)}%</td>
                <td>
                    <button class="edit-btn" onclick="editStudent('${student.studentCode}')"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" onclick="deleteStudent('${student.studentCode}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
}
function renderStats() {
    const statsSection = document.getElementById('stats-section');
    if (statsSection) {
        // تصفية: الطلاب اللي عندهم درجات فقط (subjects مش فاضي)
        const studentsWithGrades = students.filter(s => s.subjects && s.subjects.length > 0);
        const totalStudents = studentsWithGrades.length;
        
        // تعريف المواد والدرجات النهائية لكل مادة (المجموع الكلي 174)
        const subjectMaxGrades = {
            "اللغة العربية": 20,
            "اللغة الإنجليزية": 20,
            "علوم تطبيقية": 40,
            "طب باطنة": 20,
            "تمريض باطني جراحي": 24,
            "حاسب آلي": 20,
            "الدين": 30
        };
        
        const TOTAL_POSSIBLE = 174; // المجموع الكلي
        
        // حساب النسبة المئوية لكل طالب
        const studentPercentages = studentsWithGrades.map(student => {
            let totalEarned = 0;
            let totalPossible = 0;
            
            student.subjects.forEach(subject => {
                const maxGrade = subjectMaxGrades[subject.name];
                if (maxGrade) {
                    totalEarned += subject.grade || 0;
                    totalPossible += maxGrade;
                }
            });
            
            const percentage = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
            return { 
                student: student, 
                percentage: percentage,
                totalEarned: totalEarned,
                totalPossible: totalPossible
            };
        });
        
        // ترتيب الطلاب تنازلياً حسب النسبة
        const sortedByPercentage = [...studentPercentages].sort((a, b) => b.percentage - a.percentage);
        
        // أعلى طالب (الأول في الترتيب)
        const topStudent = sortedByPercentage.length > 0 ? sortedByPercentage[0] : null;
        
        // أعلى نسبة مئوية
        const highestPercentage = sortedByPercentage.length ? sortedByPercentage[0].percentage : 0;
        
        // متوسط الدرجات المئوية
        const avgGrade = sortedByPercentage.length ? 
            sortedByPercentage.reduce((a, b) => a + b.percentage, 0) / sortedByPercentage.length : 0;
        
        // عدد الناجحين (نسبة 60% فأكثر)
        const passingStudents = sortedByPercentage.filter(p => p.percentage >= 60).length;
        const failingStudents = totalStudents - passingStudents;
        
        // حساب أعلى درجة في كل مادة
        const highestGrades = Object.keys(subjectMaxGrades).map(subject => {
            let maxGrade = 0;
            let topStudentName = "";
            let topStudentCode = "";
            studentsWithGrades.forEach(student => {
                const subj = student.subjects.find(s => s.name === subject);
                if (subj && (subj.grade || 0) > maxGrade) {
                    maxGrade = subj.grade || 0;
                    topStudentName = student.fullName;
                    topStudentCode = student.studentCode;
                }
            });
            return { subject, maxGrade, maxPossible: subjectMaxGrades[subject], topStudent: topStudentName, topStudentCode: topStudentCode };
        });
        
        // حساب متوسط كل مادة
        const subjectAverages = Object.keys(subjectMaxGrades).map(subject => {
            let total = 0;
            let count = 0;
            studentsWithGrades.forEach(student => {
                const subj = student.subjects.find(s => s.name === subject);
                if (subj && subj.grade !== undefined) {
                    total += subj.grade;
                    count++;
                }
            });
            const average = count > 0 ? (total / count).toFixed(1) : 0;
            return { subject, average, maxPossible: subjectMaxGrades[subject] };
        });
        
        // بناء HTML للإحصائيات
        statsSection.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item" id="total-students">
                    <p><i class="fas fa-users"></i> عدد الطلاب: ${totalStudents}</p>
                </div>
                <div class="stat-item" id="highest-grade">
                    <p><i class="fas fa-trophy"></i> أعلى نسبة مئوية: ${highestPercentage.toFixed(1)}%</p>
                </div>
                <div class="stat-item" id="average-grade">
                    <p><i class="fas fa-chart-line"></i> متوسط النسبة: ${avgGrade.toFixed(1)}%</p>
                </div>
                <div class="stat-item" id="passing-students">
                    <p><i class="fas fa-check-circle"></i> عدد الناجحين: ${passingStudents}</p>
                </div>
                <div class="stat-item" id="failing-students">
                    <p><i class="fas fa-times-circle"></i> عدد الراسبين: ${failingStudents}</p>
                </div>
            </div>
            
            ${topStudent ? `
            <div class="stats-grid" style="margin-top: 20px; background: linear-gradient(135deg, #d4af37, #b8962e); border-radius: 15px; padding: 15px;">
                <div class="stat-item" style="background: none; box-shadow: none; text-align: center;">
                    <p><i class="fas fa-crown" style="color: #fff; font-size: 2rem;"></i></p>
                    <p style="color: #1a2526; font-size: 1.2rem; font-weight: bold;">🏆 أعلى طالب في جميع النتائج 🏆</p>
                    <p style="color: #1a2526; font-size: 1.5rem; font-weight: bold; margin: 10px 0;">${topStudent.student.fullName}</p>
                    <p style="color: #1a2526;">رقم الجلوس: ${topStudent.student.studentCode}</p>
                    <p style="color: #1a2526;">المجموع: ${topStudent.totalEarned} / ${TOTAL_POSSIBLE}</p>
                    <p style="color: #1a2526; font-size: 1.3rem;">النسبة: ${topStudent.percentage.toFixed(1)}%</p>
                </div>
            </div>
            ` : ''}
            
            <div class="stats-grid" style="margin-top: 20px;">
                <div class="stat-item">
                    <p><i class="fas fa-chart-bar"></i> <strong>📊 أعلى الدرجات في كل مادة</strong></p>
                </div>
                ${highestGrades.map(item => `
                    <div class="stat-item">
                        <p><i class="fas fa-star"></i> <strong>${item.subject}</strong><br>
                        ${item.maxGrade} / ${item.maxPossible}<br>
                        <small style="color: #666;">الطالب: ${item.topStudent || '-'} (${item.topStudentCode || ''})</small></p>
                    </div>
                `).join('')}
            </div>
            
            <div class="stats-grid" style="margin-top: 20px;">
                <div class="stat-item">
                    <p><i class="fas fa-chart-line"></i> <strong>📈 متوسط الدرجات</strong></p>
                </div>
                ${subjectAverages.map(item => `
                    <div class="stat-item">
                        <p><i class="fas fa-calculator"></i> ${item.subject}<br>
                        ${item.average} / ${item.maxPossible}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

    function renderNotifications() {
        const tableBody = document.getElementById('notifications-table-body');
        if (tableBody) {
            tableBody.innerHTML = '';
            notifications.forEach((notification, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${notification.text}</td>
                    <td>${notification.date}</td>
                    <td>
                        <button class="delete-btn" onclick="deleteNotification('${notification._id}')"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }
    }

    window.addNotification = async function() {
        const text = document.getElementById('notification-text')?.value.trim();
        if (!text) {
            showToast('يرجى إدخال نص الإشعار!', 'error');
            return;
        }
        const date = new Date().toLocaleString('ar-EG');
        const response = await saveToServer('/api/notifications', { text, date });
        if (response) {
            notifications = await getFromServer('/api/notifications');
            renderNotifications();
            showToast('تم إضافة الإشعار بنجاح!', 'success');
            document.getElementById('notification-text').value = '';
        }
    };

    window.deleteNotification = async function(id) {
        if (confirm('هل أنت متأكد من حذف هذا الإشعار؟')) {
            const response = await saveToServer(`/api/notifications/${id}`, {}, 'DELETE');
            if (response) {
                notifications = await getFromServer('/api/notifications');
                renderNotifications();
                showToast('تم حذف الإشعار بنجاح.', 'success');
            }
        }
    };

    function renderViolations() {
    const tableBody = document.getElementById('violations-table-body');
    if (tableBody) {
        tableBody.innerHTML = '';
        violations.forEach((violation) => {
            const student = students.find(s => s.studentCode === violation.studentId);
            const studentName = student ? student.fullName : 'طالب غير موجود';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${violation.studentId}</td>
                <td>${studentName}</td>
                <td>${violation.type === 'warning' ? 'إنذار' : 'مخالفة'}</td>
                <td>${violation.reason}</td>
                <td>${violation.penalty}</td>
                <td>${violation.parentSummons ? 'نعم' : 'لا'}</td>
                <td>${violation.date}</td>
                <td>
                    <button class="delete-btn" onclick="deleteViolation('${violation._id}')" style="background:#dc3545;">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="edit-btn" onclick="resendViolationWhatsApp('${violation._id}')" style="background:#25D366; margin-top:5px;">
                        <i class="fab fa-whatsapp"></i> إرسال
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
}

  document.getElementById('add-violation-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const studentId = document.getElementById('violation-student-id').value.trim();
    const type = document.getElementById('violation-type').value;
    const reason = document.getElementById('violation-reason').value.trim();
    const penalty = document.getElementById('violation-penalty').value.trim();
    const parentSummons = document.getElementById('parent-summons').checked;
    
    // الحقل الجديد لرقم ولي الأمر (اختياري - لو عايز ترسل لرقم مختلف)
    const customParentPhone = document.getElementById('parent-phone')?.value.trim();

    if (!studentId || !reason || !penalty) {
        showToast('يرجى إدخال جميع الحقول المطلوبة!', 'error');
        return;
    }

    // البحث عن الطالب
    const student = students.find(s => s.studentCode === studentId);
    if (!student) {
        showToast('رقم الجلوس غير موجود! يرجى التأكد من رقم الجلوس.', 'error');
        return;
    }

    const date = new Date().toLocaleString('ar-EG');
    
    // حفظ المخالفة في قاعدة البيانات
    const response = await saveToServer('/api/violations', { 
        studentId, 
        type, 
        reason, 
        penalty, 
        parentSummons, 
        date 
    });
    
    if (response) {
        violations = await getFromServer('/api/violations');
        renderViolations();
        showToast(`تم إضافة ${type === 'warning' ? 'إنذار' : 'مخالفة'} بنجاح!`, 'success');
        this.reset();
        
        // إرسال إشعار واتساب لولي الأمر
        // استخدام رقم ولي الأمر المخزن في قاعدة البيانات أو الرقم المخصص
        const parentPhone = customParentPhone || student.profile?.parentId;
        
        if (parentPhone && parentPhone.length >= 10) {
            showToast('جاري إرسال إشعار واتساب لولي الأمر...', 'info');
            await sendWhatsAppNotification(parentPhone, student.fullName, type, reason, penalty);
        } else if (customParentPhone) {
            showToast('رقم ولي الأمر غير صحيح أو غير مكتمل! لم يتم إرسال الإشعار.', 'warning');
        } else {
            showToast('لم يتم إرسال إشعار واتساب لأن رقم ولي الأمر غير مسجل.', 'warning');
        }
    }
});


    // ====================== إرسال إشعار واتساب لولي الأمر ======================
async function sendWhatsAppNotification(parentPhone, studentName, violationType, reason, penalty) {
    // تنظيف رقم الهاتف (إزالة أي أحرف غير أرقام)
    let cleanPhone = parentPhone.replace(/[^0-9]/g, '');
    
    // التأكد من أن الرقم يبدأ بكود مصر (20)
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '20' + cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith('20')) {
        cleanPhone = '20' + cleanPhone;
    }
    
    // إنشاء نص الرسالة
    const message = `📢 *تنبيه من مدرسة معهد رعاية الضبعية للتمريض*\n\n` +
                    `👨‍🎓 الطالب: ${studentName}\n` +
                    `⚠️ نوع التنبيه: ${violationType === 'warning' ? 'إنذار' : 'مخالفة'}\n` +
                    `📝 السبب: ${reason}\n` +
                    `⚖️ العقوبة: ${penalty}\n` +
                    `📅 التاريخ: ${new Date().toLocaleString('ar-EG')}\n\n` +
                    `يرجى متابعة الطالب واتخاذ اللازم.`;
    
    // تشفير الرسالة للرابط
    const encodedMessage = encodeURIComponent(message);
    
    // رابط واتساب المباشر
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    
    // فتح نافذة واتساب في تبويب جديد
    window.open(whatsappUrl, '_blank');
    
    return whatsappUrl;
}


    // دالة لإعادة إرسال إشعار واتساب لمخالفة موجودة
window.resendViolationWhatsApp = async function(violationId) {
    const violation = violations.find(v => v._id === violationId);
    if (!violation) {
        showToast('لم يتم العثور على المخالفة!', 'error');
        return;
    }
    
    const student = students.find(s => s.studentCode === violation.studentId);
    if (!student) {
        showToast('لم يتم العثور على الطالب!', 'error');
        return;
    }
    
    const parentPhone = student.profile?.parentId;
    if (!parentPhone || parentPhone.length < 10) {
        showToast('رقم ولي الأمر غير مسجل لهذا الطالب!', 'error');
        return;
    }
    
    showToast('جاري فتح واتساب لإرسال الإشعار...', 'info');
    await sendWhatsAppNotification(
        parentPhone, 
        student.fullName, 
        violation.type, 
        violation.reason, 
        violation.penalty
    );
};
    

    window.deleteViolation = async function(id) {
        if (confirm('هل أنت متأكد من حذف هذا الإنذار/المخالفة؟')) {
            const response = await saveToServer(`/api/violations/${id}`, {}, 'DELETE');
            if (response) {
                violations = await getFromServer('/api/violations');
                renderViolations();
                showToast('تم حذف الإنذار/المخالفة بنجاح.', 'success');
            }
        }
    };

    window.processText = async function() {
        const textInput = document.getElementById('text-input')?.value.trim();
        if (!textInput) {
            showToast('يرجى إلصق النص أولاً!', 'error');
            return;
        }
        const lines = textInput.split('\n').filter(line => line.trim() !== '');
        let addedCount = 0;
        let updatedCount = 0;
        for (const line of lines) {
            const parts = line.split('|').map(part => part.trim());
            if (parts.length === 10) {
                const fullName = parts[0];
                const studentId = parts[1];
                const subjects = [
                    { name: "مبادئ وأسس تمريض", grade: parseInt(parts[2]) || 0 },
                    { name: "اللغة العربية", grade: parseInt(parts[3]) || 0 },
                    { name: "اللغة الإنجليزية", grade: parseInt(parts[4]) || 0 },
                    { name: "الفيزياء", grade: parseInt(parts[5]) || 0 },
                    { name: "الكيمياء", grade: parseInt(parts[6]) || 0 },
                    { name: "التشريح / علم وظائف الأعضاء", grade: parseInt(parts[7]) || 0 },
                    { name: "التربية الدينية", grade: parseInt(parts[8]) || 0 },
                    { name: "الكمبيوتر", grade: parseInt(parts[9]) || 0 }
                ];

                const existingStudent = students.find(s => s.id === studentId);
                if (existingStudent) {
                    const response = await saveToServer(`/api/students/${studentId}`, { subjects }, 'PUT');
                    if (response) updatedCount++;
                } else {
                    const response = await saveToServer('/api/students', { fullName, id: studentId, subjects });
                    if (response) addedCount++;
                }
            }
        }
        students = await getFromServer('/api/students');
        renderResults();
        renderStats();
        showToast(`تم تحليل النص وإضافة ${addedCount} طالب جديد وتحديث ${updatedCount} طالب بنجاح!`, 'success');
        document.getElementById('text-input').value = '';
    };


function displayPDFResults(results) {
    console.log('نتائج الـ PDF المستلمة:', results); // تسجيل النتائج الواردة
    const resultsDisplay = document.getElementById('results-display');
    if (!resultsDisplay) {
        console.error('عنصر results-display غير موجود في DOM');
        return;
    }
    resultsDisplay.innerHTML = ''; // مسح المحتوى السابق

    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>البيانات</th>
                <th>القيم</th>
                <th>المجموع</th>
                <th>النسبة</th>
                <th>الإجراء</th>
            </tr>
        </thead>
        <tbody id="pdf-results-body"></tbody>
    `;
    const tbody = table.querySelector('#pdf-results-body');

    // قائمة المواد المتوقعة
    const validSubjects = [
        'مبادئ وأسس تمريض',
        'اللغة العربية',
        'اللغة الإنجليزية',
        'الفيزياء',
        'الكيمياء',
        'التشريح/علم وظائف الأعضاء',
        'التربية الدينية',
        'الكمبيوتر'
    ];

    results.forEach(student => {
        // حساب المجموع
        const grades = Object.values(student.results);
        const total = grades.reduce((sum, grade) => sum + (parseInt(grade) || 0), 0);
        // حساب النسبة بناءً على عدد المواد المتوقعة (8)
        const percentage = (total / (validSubjects.length * 100)) * 100;
        console.log(`طالب: ${student.name}, المجموع: ${total}, النسبة: ${percentage.toFixed(1)}%`); // تسجيل الحسابات

        // تحديد فئة النسبة للتنسيق
        let percentageClass = '';
        if (percentage >= 85) percentageClass = 'high-percentage';
        else if (percentage >= 60) percentageClass = 'medium-percentage';
        else percentageClass = 'low-percentage';

        // إنشاء صف الجدول
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>اسم: ${student.name}<br>رقم الجلوس: ${student.id}</td>
            <td>${Object.entries(student.results).map(([sub, grade]) => `${sub}: ${grade}`).join('<br>')}</td>
            <td>${total}</td>
            <td class="${percentageClass}">${percentage.toFixed(1)}%</td>
            <td>
                <button class="edit-btn" onclick="editStudent('${student.id}')"><i class="fas fa-edit"></i></button>
                <button class="delete-btn" onclick="deleteStudent('${student.id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });

    resultsDisplay.appendChild(table);
    console.log('تم إنشاء الجدول وعرضه في results-display');
}

    window.analyzePDF = async function() {
        console.log('تم النقر على زر تحليل الملف');
        const fileInput = document.getElementById('pdf-upload');
        if (!fileInput) {
            console.error('عنصر pdf-upload غير موجود في DOM');
            showToast('خطأ: عنصر إدخال الملف غير موجود!', 'error');
            return;
        }
        const file = fileInput.files[0];
        if (!file || file.type !== 'application/pdf') {
            console.error('لم يتم اختيار ملف PDF صالح:', file);
            showToast('يرجى اختيار ملف PDF صالح!', 'error');
            return;
        }
        const fileReader = new FileReader();
        fileReader.onload = async function() {
            try {
                console.log('بدء قراءة ملف PDF');
                const base64String = fileReader.result.split(',')[1]; // استخراج Base64
                console.log('Base64 المرسل:', base64String.substring(0, 50) + '...');
                const response = await saveToServer('/api/analyze-pdf', { pdfData: base64String });
                if (response && response.results) {
                    displayPDFResults(response.results);
                    students = await getFromServer('/api/students');
                    renderResults();
                    renderStats();
                    showToast(`تم تحليل الملف وإضافة/تحديث ${response.results.length} طالب بنجاح!`, 'success');
                } else {
                    console.error('لا توجد نتائج في استجابة الخادم:', response);
                    showToast('خطأ في تحليل الملف: لا توجد نتائج!', 'error');
                }
            } catch (error) {
                console.error('خطأ في تحليل PDF:', error);
                showToast(`خطأ في تحليل الملف: ${error.message}`, 'error');
            }
        };
        fileReader.onerror = function(error) {
            console.error('خطأ في قراءة الملف:', error);
            showToast('خطأ في قراءة الملف!', 'error');
        };
        fileReader.readAsDataURL(file);
    };

    document.getElementById('analyze-pdf')?.addEventListener('click', () => {
        console.log('ربط معالج الحدث لزر analyze-pdf');
        window.analyzePDF();
    });

    document.getElementById('add-result-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const fullName = document.getElementById('student-name').value.trim();
    const studentId = document.getElementById('student-id').value.trim();
    const semester = document.getElementById('semester').value;
    const subject1 = parseInt(document.getElementById('subject1').value) || 0;
    const subject2 = parseInt(document.getElementById('subject2').value) || 0;
    const subject3 = parseInt(document.getElementById('subject3').value) || 0;
    const subject4 = parseInt(document.getElementById('subject4').value) || 0;
    const subject5 = parseInt(document.getElementById('subject5').value) || 0;
    const subject6 = parseInt(document.getElementById('subject6').value) || 0;
    const subject7 = parseInt(document.getElementById('subject7').value) || 0;
    const subject8 = parseInt(document.getElementById('subject8').value) || 0;
    const subject9 = parseInt(document.getElementById('subject9').value) || 0;
    const subject10 = parseInt(document.getElementById('subject10').value) || 0;

    if (!fullName || !studentId) {
        showToast('يرجى إدخال اسم الطالب ورقم الجلوس!', 'error');
        return;
    }

    if ([subject1, subject2, subject3, subject4, subject5, subject6, subject7, subject8, subject9, subject10].some(g => g < 0 || g > 100)) {
        showToast('تأكد أن جميع الدرجات بين 0 و100!', 'error');
        return;
    }

    const subjects = [
        { name: "مبادئ وأسس تمريض", grade: subject1 },
        { name: "اللغة العربية", grade: subject2 },
        { name: "اللغة الإنجليزية", grade: subject3 },
        { name: "الفيزياء", grade: subject4 },
        { name: "الكيمياء", grade: subject5 },
        { name: "التشريح / علم وظائف الأعضاء", grade: subject6 },
        { name: "التربية الدينية", grade: subject7 },
        { name: "الكمبيوتر", grade: subject8 }
    ];

    if (semester === 'first') {
        if (subject9 > 0) { // إضافة التاريخ فقط إذا كانت الدرجة أكبر من 0
            subjects.push({ name: "التاريخ", grade: subject9 });
        }
    } else {
        if (subject10 > 0) { // إضافة الجغرافيا فقط إذا كانت الدرجة أكبر من 0
            subjects.push({ name: "الجغرافيا", grade: subject10 });
        }
    }

    console.log('البيانات المرسلة:', { fullName, studentId, semester, subjects }); // تسجيل البيانات

    const existingStudent = students.find(s => s.id === studentId);
    if (existingStudent) {
        const response = await saveToServer(`/api/students/${studentId}`, { subjects, semester }, 'PUT');
        if (response) {
            students = await getFromServer('/api/students');
            console.log('البيانات المحدثة من الخادم:', students.find(s => s.id === studentId)); // تسجيل بيانات الطالب المحدثة
            renderResults();
            renderStats();
            showToast(`تم تحديث درجات الطالب ${fullName} بنجاح!`, 'success');
            this.reset();
            toggleSubjects();
        }
    } else {
        const response = await saveToServer('/api/students', { fullName, id: studentId, subjects, semester });
        if (response) {
            students = await getFromServer('/api/students');
            console.log('بيانات الطالب الجديد:', response); // تسجيل بيانات الطالب الجديد
            renderResults();
            renderStats();
            showToast(`تم إضافة الطالب بنجاح!\nاسم المستخدم: ${response.student.username}\nكلمة المرور: ${response.student.originalPassword}`, 'success');
            this.reset();
            toggleSubjects();
        }
    }
});

    window.deleteStudent = async function(studentId) {
        if (confirm('هل أنت متأكد؟ لن تتمكن من استرجاع بيانات هذا الطالب!')) {
            const response = await saveToServer(`/api/students/${studentId}`, {}, 'DELETE');
            if (response) {
                students = await getFromServer('/api/students');
                violations = await getFromServer('/api/violations');
                renderResults();
                renderStats();
                renderViolations();
                showToast('تم حذف الطالب بنجاح.', 'success');
            }
        }
    };
    window.toggleSubjects = function() {
    const semester = document.getElementById('semester').value;
    const historyGroup = document.getElementById('history-group');
    const geographyGroup = document.getElementById('geography-group');

    if (semester === 'first') {
        historyGroup.style.display = 'block';
        geographyGroup.style.display = 'none';
        document.getElementById('subject10').value = ''; // إعادة تعيين درجة الجغرافيا
    } else {
        historyGroup.style.display = 'none';
        geographyGroup.style.display = 'block';
        document.getElementById('subject9').value = ''; // إعادة تعيين درجة التاريخ
    }
};

    window.editStudent = function(studentId) {
        const student = students.find(s => s.id === studentId);
        if (student) {
            document.getElementById('student-name').value = student.fullName;
            document.getElementById('student-id').value = student.id;
            document.getElementById('subject1').value = student.subjects[0]?.grade || 0;
            document.getElementById('subject2').value = student.subjects[1]?.grade || 0;
            document.getElementById('subject3').value = student.subjects[2]?.grade || 0;
            document.getElementById('subject4').value = student.subjects[3]?.grade || 0;
            document.getElementById('subject5').value = student.subjects[4]?.grade || 0;
            document.getElementById('subject6').value = student.subjects[5]?.grade || 0;
            document.getElementById('subject7').value = student.subjects[6]?.grade || 0;
            document.getElementById('subject8').value = student.subjects[7]?.grade || 0;
        }
    };

    window.scrollToTop = function() {
        document.querySelector('.admin-container')?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.scrollToBottom = function() {
        const container = document.querySelector('.admin-container');
        if (container) {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
    };

 // دالة للتحقق من توفر كود الاختبار
async function checkExamCodeAvailability(code) {
    try {
        const response = await fetch('/api/exams/check-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await response.json();
        return data.available;
    } catch (error) {
        console.error('Error checking exam code:', error);
        showToast('فشل التحقق من كود الاختبار!', 'error');
        return false;
    }
}


// دالة لإنشاء واجهة إدخال الأسئلة بناءً على نوع السؤال
function renderQuestionInputs() {
    const type = document.getElementById('question-type').value;
    const inputsDiv = document.getElementById('question-inputs');
    inputsDiv.innerHTML = '';

    if (type === 'multiple') {
        inputsDiv.innerHTML = `
            <div class="input-group">
                <label for="question-text">نص السؤال <span class="required">*</span></label>
                <input type="text" id="question-text" placeholder="أدخل نص السؤال" required>
            </div>
            <div class="input-group">
                <label>الخيارات (اختر الإجابة الصحيحة بعلامة الصح)</label>
                <div class="options-container">
                    <div><input type="text" class="option-input" placeholder="الخيار 1"><i class="fas fa-check correct-option"></i></div>
                    <div><input type="text" class="option-input" placeholder="الخيار 2"><i class="fas fa-check correct-option"></i></div>
                    <div><input type="text" class="option-input" placeholder="الخيار 3"><i class="fas fa-check correct-option"></i></div>
                    <div><input type="text" class="option-input" placeholder="الخيار 4"><i class="fas fa-check correct-option"></i></div>
                </div>
            </div>
        `;
    } else if (type === 'essay') {
        inputsDiv.innerHTML = `
            <div class="input-group">
                <label for="question-text">نص السؤال <span class="required">*</span></label>
                <input type="text" id="question-text" placeholder="أدخل نص السؤال" required>
            </div>
            <div class="input-group">
                <label for="answer-text">الإجابة النموذجية <span class="required">*</span></label>
                <textarea id="answer-text" rows="4" placeholder="أدخل الإجابة النموذجية"></textarea>
            </div>
        `;
    } else if (type === 'list') {
        inputsDiv.innerHTML = `
            <div class="input-group">
                <label for="question-text">نص السؤال <span class="required">*</span></label>
                <input type="text" id="question-text" placeholder="أدخل نص السؤال" required>
            </div>
            <div class="input-group">
                <label>الإجابات (مرقمة من 1 إلى 5)</label>
                <div class="list-container">
                    <div><span>1.</span><input type="text" class="list-input" placeholder="الإجابة 1"></div>
                    <div><span>2.</span><input type="text" class="list-input" placeholder="الإجابة 2"></div>
                    <div><span>3.</span><input type="text" class="list-input" placeholder="الإجابة 3"></div>
                    <div><span>4.</span><input type="text" class="list-input" placeholder="الإجابة 4"></div>
                    <div><span>5.</span><input type="text" class="list-input" placeholder="الإجابة 5"></div>
                </div>
            </div>
        `;
    } else if (type === 'truefalse') {
        inputsDiv.innerHTML = `
            <div class="input-group">
                <label for="question-text">نص السؤال <span class="required">*</span></label>
                <input type="text" id="question-text" placeholder="أدخل نص السؤال" required>
            </div>
            <div class="input-group">
                <label>الإجابة</label>
                <select id="truefalse-answer">
                    <option value="true">صح</option>
                    <option value="false">خطأ</option>
                </select>
            </div>
        `;
    }

    // إدارة اختيار الإجابة الصحيحة للأسئلة الاختيارية
    document.querySelectorAll('.correct-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.correct-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
}

// تحديث واجهة إدخال الأسئلة عند تغيير نوع السؤال
document.getElementById('question-type').addEventListener('change', renderQuestionInputs);

// إضافة سؤال إلى القائمة
let questions = [];
document.getElementById('add-question').addEventListener('click', function() {
    const type = document.getElementById('question-type').value;
    const questionText = document.getElementById('question-text')?.value.trim();
    if (!questionText) {
        showToast('يرجى إدخال نص السؤال!', 'error');
        return;
    }

    let question = { type, text: questionText };
    if (type === 'multiple') {
        const options = Array.from(document.querySelectorAll('.option-input')).map(input => input.value.trim());
        const correctIndex = Array.from(document.querySelectorAll('.correct-option')).findIndex(opt => opt.classList.contains('selected'));
        if (options.some(opt => !opt) || correctIndex === -1) {
            showToast('يرجى إدخال جميع الخيارات واختيار الإجابة الصحيحة!', 'error');
            return;
        }
        question.options = options;
        question.correctAnswer = options[correctIndex];
    } else if (type === 'essay') {
        const answer = document.getElementById('answer-text').value.trim();
        if (!answer) {
            showToast('يرجى إدخال الإجابة النموذجية!', 'error');
            return;
        }
        question.correctAnswer = answer;
    } else if (type === 'list') {
        const answers = Array.from(document.querySelectorAll('.list-input')).map(input => input.value.trim()).filter(val => val);
        if (answers.length === 0) {
            showToast('يرجى إدخال إجابة واحدة على الأقل!', 'error');
            return;
        }
        question.correctAnswers = answers;
    } else if (type === 'truefalse') {
        question.correctAnswer = document.getElementById('truefalse-answer').value;
    }

    questions.push(question);
    renderQuestionsList();
    showToast('تم إضافة السؤال بنجاح!', 'success');
});

// عرض قائمة الأسئلة
function renderQuestionsList() {
    const questionsList = document.getElementById('questions-list');
    questionsList.innerHTML = questions.map((q, index) => `
        <div class="question-item">
            <p><strong>سؤال ${index + 1} (${q.type === 'multiple' ? 'اختياري' : q.type === 'essay' ? 'مقالي' : q.type === 'list' ? 'قائمة' : 'صح/خطأ'}):</strong> ${q.text}</p>
            ${q.options ? `<p>الخيارات: ${q.options.join(', ')} (الصحيح: ${q.correctAnswer})</p>` : ''}
            ${q.correctAnswer && !q.options ? `<p>الإجابة: ${q.correctAnswer}</p>` : ''}
            ${q.correctAnswers ? `<p>الإجابات: ${q.correctAnswers.join(', ')}</p>` : ''}
            <button class="delete-question" data-index="${index}">حذف</button>
        </div>
    `).join('');

    document.querySelectorAll('.delete-question').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.dataset.index;
            questions.splice(index, 1);
            renderQuestionsList();
            showToast('تم حذف السؤال!', 'success');
        });
    });
}

// حفظ الاختبار
document.getElementById('save-exam').addEventListener('click', async function() {
    const examName = document.getElementById('exam-name').value.trim();
    const examCode = document.getElementById('exam-code').value.trim();
    const stage = document.getElementById('exam-stage').value;
    const duration = document.getElementById('exam-duration').value.trim();

    if (!examName || !examCode || !duration || questions.length === 0) {
        showToast('يرجى إدخال اسم الاختبار، كود الاختبار، مدة الاختبار، وإضافة سؤال واحد على الأقل!', 'error');
        return;
    }

    if (examCode.length < 6) {
        showToast('كود الاختبار يجب أن يكون 6 أحرف على الأقل!', 'error');
        return;
    }

    if (duration <= 0) {
        showToast('مدة الاختبار يجب أن تكون أكبر من صفر!', 'error');
        return;
    }

    const isCodeAvailable = await checkExamCodeAvailability(examCode);
    if (!isCodeAvailable) {
        showToast('كود الاختبار مستخدم مسبقًا! يرجى اختيار كود آخر.', 'error');
        return;
    }

    try {
        console.log('Saving exam with data:', JSON.stringify({ name: examName, stage, code: examCode, duration: parseInt(duration), questions }, null, 2));
        const response = await fetch('/api/exams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: examName, stage, code: examCode, duration: parseInt(duration), questions })
});

        if (response.ok) {
            const result = await response.json();
            showToast(`تم حفظ الاختبار "${examName}" بكود: ${examCode}`, 'success');
            questions = [];
            renderQuestionsList();
            document.getElementById('exam-name').value = '';
            document.getElementById('exam-code').value = '';
            document.getElementById('exam-duration').value = '';
            document.getElementById('code-availability').style.display = 'none';
        } else {
            const errorData = await response.json();
            console.error('Error saving exam:', errorData);
            showToast(`خطأ في حفظ الاختبار: ${errorData.error || 'غير معروف'}`, 'error');
        }
    } catch (error) {
        console.error('Error saving exam:', error);
        showToast(`خطأ في حفظ الاختبار: ${error.message}`, 'error');
    }
});
// عرض نتائج الاختبار
document.getElementById('fetch-results').addEventListener('click', async function() {
    const examCode = document.getElementById('results-exam-code').value.trim();
    if (!examCode) {
        showToast('يرجى إدخال كود الاختبار!', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/exams/${encodeURIComponent(examCode)}/results`);
        if (!response.ok) {
            const errorData = await response.json();
            showToast(errorData.error || 'كود الاختبار غير صحيح!', 'error');
            return;
        }
        const results = await response.json();
        const resultsList = document.getElementById('exam-results-list');
        if (results.length === 0) {
            resultsList.innerHTML = '<p style="text-align: center; color: #1a2526;">لا توجد نتائج لهذا الاختبار.</p>';
            return;
        }
        resultsList.innerHTML = `
            <table class="test-results-table">
                <thead>
                    <tr>
                        <th>اسم المستخدم</th>
                        <th>النتيجة (%)</th>
                        <th>تاريخ الإكمال</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(result => {
                        let scoreCategory;
                        if (result.score >= 80) scoreCategory = 'excellent';
                        else if (result.score >= 50) scoreCategory = 'good';
                        else scoreCategory = 'poor';
                        return `
                            <tr>
                                <td>${result.studentId}</td>
                                <td data-score="${scoreCategory}">${result.score.toFixed(1)}</td>
                                <td>${new Date(result.completionTime).toLocaleString('ar-EG')}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error fetching exam results:', error);
        showToast(`خطأ في جلب النتائج: ${error.message}`, 'error');
    }
});
    // أضف هذا في آخر الملف قبل `});`
window.logout = function () {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        localStorage.removeItem('loggedInUser');
        window.location.href = 'login.html';
    }
};


// ====================== نتايج الاختبارات الشهرية (النسخة المطورة) ======================

document.getElementById('analyze-monthly')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('monthly-upload');
    const monthInput = document.getElementById('monthly-month').value.trim();

    const file = fileInput.files[0];

    if (!file) {
        showToast('يرجى اختيار ملف PDF أو صورة أولاً!', 'error');
        return;
    }
    if (!monthInput) {
        showToast('يرجى إدخال اسم الشهر!', 'error');
        return;
    }

    showToast('جاري تحليل الملف...', 'info');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('month', monthInput);

    try {
        const response = await fetch('/api/analyze-monthly', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showToast(`تم تحليل وإضافة ${result.count} نتيجة شهرية بنجاح!`, 'success');
            renderMonthlyResults(result.results);
        } else {
            showToast(result.message || 'فشل التحليل', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('حدث خطأ أثناء التحليل', 'error');
    }
});

function renderMonthlyResults(results) {
    const container = document.getElementById('monthly-results-display');
    container.innerHTML = `
        <table class="results-table">
            <thead>
                <tr>
                    <th>اسم الطالب</th>
                    <th>المادة</th>
                    <th>الدرجة</th>
                    <th>كود الطالب</th>
                    <th>الشهر</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(r => `
                    <tr>
                        <td>${r.studentName}</td>
                        <td>${r.subject}</td>
                        <td>${r.grade}</td>
                        <td><strong>${r.studentCode}</strong></td>
                        <td>${r.month}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}


// تأكد من هذا الرابط في <head> أو قبل أي سكريبت: 
// <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>


// تعريف دالة تحليل الملف
window.analyzeExcel = async function() {
    const fileInput = document.getElementById('excel-upload');
    if (!fileInput || !fileInput.files.length) {
        showToast('يرجى اختيار ملف Excel!', 'error');
        return;
    }
    const file = fileInput.files[0];

    showToast('جاري تحليل الملف...', 'info');

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            if (rows.length <= 1) {
                showToast("الملف فارغ أو ناقص!", "error");
                return;
            }

            let added = 0;
            let updated = 0;
            
            for (let i = 1; i < rows.length; i++) {
                let row = rows[i];
                if (!row[0] || !row[1]) continue;
                
                // ⚠️ التعديل الأهم: استخدام studentCode بدلاً من id
                const studentCode = String(row[0]).trim();
                const fullName = String(row[1]).trim();
                
                // بناء قائمة المواد
                const subjects = [];
                if (row[2] !== undefined && row[2] !== '') subjects.push({ name: "اللغة العربية", grade: parseFloat(row[2]) || 0 });
                if (row[3] !== undefined && row[3] !== '') subjects.push({ name: "اللغة الإنجليزية", grade: parseFloat(row[3]) || 0 });
                if (row[4] !== undefined && row[4] !== '') subjects.push({ name: "علوم تطبيقية", grade: parseFloat(row[4]) || 0 });
                if (row[5] !== undefined && row[5] !== '') subjects.push({ name: "طب باطنة", grade: parseFloat(row[5]) || 0 });
                if (row[6] !== undefined && row[6] !== '') subjects.push({ name: "تمريض باطني جراحي", grade: parseFloat(row[6]) || 0 });
                if (row[7] !== undefined && row[7] !== '') subjects.push({ name: "حاسب آلي", grade: parseFloat(row[7]) || 0 });
                if (row[8] !== undefined && row[8] !== '') subjects.push({ name: "الدين", grade: parseFloat(row[8]) || 0 });
                
                // التحقق من وجود الطالب مسبقاً
                const existingStudent = students.find(s => s.studentCode === studentCode);
                
                if (existingStudent) {
                    // تحديث الطالب الموجود
                    const updateResponse = await fetch(`/api/students/${studentCode}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fullName: fullName,
                            subjects: subjects
                        })
                    });
                    if (updateResponse.ok) updated++;
                    console.log(`✅ تم تحديث الطالب: ${fullName} (${studentCode})`);
                } else {
                    // إنشاء طالب جديد
                    const response = await saveToServer('/api/students', { 
                        fullName, 
                        id: studentCode,  // السيرفر بيستقبل id وبعدين يحوله لـ studentCode
                        subjects,
                        semester: 'first'
                    });
                    if (response) added++;
                    console.log(`✅ تم إضافة طالب جديد: ${fullName} (${studentCode})`);
                }
            }
            
            // إعادة تحميل البيانات من السيرفر
            students = await getFromServer('/api/students');
            renderResults();
            renderStats();
            
            showToast(`تم تحليل الملف: إضافة ${added} طالب جديد، تحديث ${updated} طالب`, 'success');
            
        } catch (err) {
            console.error('Excel analysis error:', err);
            showToast("حدث خطأ أثناء تحليل الملف: " + err.message, "error");
        }
    };
    reader.onerror = function() {
        showToast("خطأ أثناء قراءة الملف!", "error");
    };
    reader.readAsArrayBuffer(file);
};

// ربط الزر بالدالة عند تحميل الصفحة (خارج أي DOMContentLoaded لأقصى أمان)
setTimeout(function() {
    var btn = document.getElementById('analyze-excel');
    if (btn) {
        btn.onclick = window.analyzeExcel;
    }
}, 0);


window.deleteAllResults = async function() {
    if (!confirm('تحذير: هذا سيمسح جميع الطلاب ودرجاتهم نهائيًا! هل أنت متأكد؟')) return;

    try {
        const response = await fetch('/api/students/all', { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
            students = [];
            renderResults();
            renderStats();
            showToast('تم حذف جميع النتائج بنجاح!', 'success');
        } else {
            showToast('تعذر حذف النتائج!', 'error');
        }
    } catch (err) {
        showToast('حدث خطأ أثناء حذف النتائج!', 'error');
    }
};

if (document.getElementById('delete-all-results')) {
    document.getElementById('delete-all-results').addEventListener('click', window.deleteAllResults);
}



// استدعاء دالة إنشاء الواجهة عند التحميل
renderQuestionInputs();
    loadInitialData();
    renderAdminWelcomeMessage();
});
