require('dotenv').config();
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Found' : '❌ Not found');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');

const app = express();

// ====================== MIDDLEWARE ======================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ====================== دالة التشفير ======================
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// ====================== النماذج (Schemas) ======================
const adminSchema = new mongoose.Schema({
    fullName: String,
    username: { type: String, unique: true },
    password: String,
    profile: {
        phone: String,
        email: String
    }
});

const studentSchema = new mongoose.Schema({
    fullName: String,
    studentCode: { type: String, required: true, unique: true },
    username: { type: String, unique: true },
    password: String,
      grade: { type: String, enum: ['first', 'second', 'third'], default: 'first' }, // 👈 الحقل الجديد
    semester: String,
    subjects: Array,
    profile: {
        phone: String,
        parentName: String,
        parentId: String
    }
}, { timestamps: true });

const violationSchema = new mongoose.Schema({
    studentId: String,
    type: String,
    reason: String,
    penalty: String,
    parentSummons: Boolean,
    date: String
});

const notificationSchema = new mongoose.Schema({
    text: String,
    date: String
});

const weeklyQuizSchema = new mongoose.Schema({
    weekNumber: { type: Number, required: true },
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctIndex: { type: Number, required: true },
    winners: [{
        studentId: String,
        username: String,
        fullName: String,
        answeredAt: { type: Date, default: Date.now }
    }],
    isActive: { type: Boolean, default: true }
});

const examSchema = new mongoose.Schema({
    name: { type: String, required: true },
    stage: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    duration: { type: Number, required: true },
    questions: [{
        type: { type: String, required: true },
        text: { type: String, required: true },
        options: [String],
        correctAnswer: String,
        correctAnswers: [String]
    }]
});

const examResultSchema = new mongoose.Schema({
    examCode: { type: String, required: true },
    studentId: { type: String, required: true },
    score: { type: Number, required: true },
    completionTime: { type: Date, default: Date.now }
});

// إنشاء النماذج (تجنب إعادة التعريف)
const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
const Student = mongoose.models.Student || mongoose.model('Student', studentSchema);
const Violation = mongoose.models.Violation || mongoose.model('Violation', violationSchema);
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
const WeeklyQuiz = mongoose.models.WeeklyQuiz || mongoose.model('WeeklyQuiz', weeklyQuizSchema);
const Exam = mongoose.models.Exam || mongoose.model('Exam', examSchema);
const ExamResult = mongoose.models.ExamResult || mongoose.model('ExamResult', examResultSchema);

// ====================== الاتصال بقاعدة البيانات ======================
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment variables!');
} else {
    console.log('📡 Connecting to MongoDB...');
    mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
    })
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => console.error('❌ MongoDB connection error:', err.message));
}


// ====================== نموذج الحضور والغياب ======================
const attendanceSchema = new mongoose.Schema({
    studentCode: { type: String, required: true }, // رقم جلوس الطالب
    studentName: { type: String, required: true }, // اسم الطالب
    date: { type: String, required: true },        // التاريخ (YYYY-MM-DD)
    status: { type: String, enum: ['present', 'absent', 'late'], default: 'present' }, // حاضر، غائب، متأخر
    note: { type: String, default: '' },           // ملاحظة (مثال: مريض)
    recordedBy: { type: String, default: '' }      // من سجل الحضور (أدمن)
});

const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);


// ====================== دوال مساعدة ======================
function generateUniqueUsername(fullName, id, existingUsers) {
    let baseUsername = fullName.toLowerCase().replace(/\s+/g, '').slice(0, 10) + id.slice(-2);
    let username = baseUsername;
    let counter = 1;
    while (existingUsers.some(user => user.username === username)) {
        username = `${baseUsername}${counter}`;
        counter++;
    }
    return username;
}

function generatePassword(fullName) {
    const firstName = fullName.split(' ')[0];
    return `${firstName.charAt(0).toUpperCase() + firstName.slice(1)}1234@`;
}

// ====================== API Routes ======================

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        status: 'ok',
        mongodb_state: mongoose.connection.readyState,
        mongodb_status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        message: 'API is working!',
        timestamp: new Date().toISOString()
    });
});

// ====================== الأدمنز ======================

app.get('/api/admins', async (req, res) => {
    try {
        const admins = await Admin.find().select('-password');
        res.json(admins);
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ error: 'خطأ في جلب الأدمنز' });
    }
});

app.get('/api/admins/:username', async (req, res) => {
    try {
        const admin = await Admin.findOne({ username: req.params.username }).select('-password');
        if (!admin) {
            return res.status(404).json({ error: 'الأدمن غير موجود' });
        }
        res.json(admin);
    } catch (error) {
        console.error('Error fetching admin:', error);
        res.status(500).json({ error: 'فشل في جلب البيانات' });
    }
});

app.post('/api/admins', async (req, res) => {
    try {
        const { fullName, username, password } = req.body;
        const existingAdmin = await Admin.findOne({ username });
        if (existingAdmin) {
            return res.status(400).json({ error: 'اسم المستخدم موجود بالفعل' });
        }
        const hashedPassword = hashPassword(password);
        const newAdmin = new Admin({ fullName, username, password: hashedPassword });
        await newAdmin.save();
        res.json({ message: 'تم إضافة الأدمن', admin: { fullName, username } });
    } catch (error) {
        console.error('Error adding admin:', error);
        res.status(500).json({ error: 'خطأ في إضافة الأدمن' });
    }
});

app.put('/api/admins/:username', async (req, res) => {
    try {
        const { profile } = req.body;
        const updated = await Admin.findOneAndUpdate(
            { username: req.params.username },
            { profile: profile || {} },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'الأدمن غير موجود' });
        res.json({ message: 'تم تحديث بيانات الأدمن', admin: updated });
    } catch (error) {
        res.status(500).json({ error: 'فشل في التحديث' });
    }
});

app.delete('/api/admins/:username', async (req, res) => {
    try {
        const admins = await Admin.find();
        if (admins.length <= 1) {
            return res.status(400).json({ error: 'لا يمكن حذف آخر أدمن' });
        }
        await Admin.deleteOne({ username: req.params.username });
        res.json({ message: 'تم حذف الأدمن' });
    } catch (error) {
        console.error('Error deleting admin:', error);
        res.status(500).json({ error: 'خطأ في حذف الأدمن' });
    }
});

// ====================== الطلاب ======================

app.get('/api/students', async (req, res) => {
    try {
        const students = await Student.find().select('-password');
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'خطأ في جلب الطلاب' });
    }
});

app.get('/api/students/:username', async (req, res) => {
    try {
        const student = await Student.findOne({ username: req.params.username }).select('-password');
        if (!student) {
            return res.status(404).json({ error: 'الطالب غير موجود' });
        }
        res.json(student);
    } catch (error) {
        console.error('Error fetching student:', error);
        res.status(500).json({ error: 'فشل في جلب البيانات' });
    }
});

app.post('/api/students', async (req, res) => {
    try {
        const { fullName, id, subjects, semester } = req.body;
        const existingAdmins = await Admin.find();
        const existingStudents = await Student.find();
        const username = generateUniqueUsername(fullName, id, [...existingAdmins, ...existingStudents]);
        const originalPassword = generatePassword(fullName);
        const hashedPassword = hashPassword(originalPassword);
        
        const newStudent = new Student({
            fullName,
            studentCode: id,
            username,
            password: hashedPassword,
            semester: semester || 'first',
            subjects: subjects || [],
            profile: { phone: '', parentName: '', parentId: '' }
        });
        await newStudent.save();
        res.json({ message: 'تم إضافة الطالب', student: { fullName, username, studentCode: id, password: originalPassword } });
    } catch (error) {
        console.error('Error adding student:', error);
        res.status(500).json({ error: 'خطأ في إضافة الطالب' });
    }
});

app.put('/api/students/:studentCode', async (req, res) => {
    try {
        const { fullName, username, studentCode, password, profile, subjects, semester } = req.body;
        
        const updateData = {};
        if (fullName !== undefined) updateData.fullName = fullName;
        if (username !== undefined) updateData.username = username;
        if (studentCode !== undefined) updateData.studentCode = studentCode;
        if (profile !== undefined) updateData.profile = profile;
        if (subjects !== undefined) updateData.subjects = subjects;
        if (semester !== undefined) updateData.semester = semester;
        
        if (password && password !== '********') {
            updateData.password = hashPassword(password);
        }
        
        const updated = await Student.findOneAndUpdate(
            { studentCode: req.params.studentCode },
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!updated) {
            return res.status(404).json({ error: 'الطالب غير موجود' });
        }
        
        const studentWithoutPassword = updated.toObject();
        delete studentWithoutPassword.password;
        
        res.json({ message: 'تم تحديث الطالب', student: studentWithoutPassword });
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).json({ error: 'فشل في التحديث: ' + error.message });
    }
});

app.delete('/api/students/:studentCode', async (req, res) => {
    try {
        const student = await Student.findOneAndDelete({ studentCode: req.params.studentCode });
        if (!student) {
            return res.status(404).json({ error: 'الطالب غير موجود' });
        }
        await Violation.deleteMany({ studentId: req.params.studentCode });
        res.json({ message: 'تم حذف الطالب' });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ error: 'خطأ في حذف الطالب' });
    }
});

// ====================== تسجيل الدخول ======================
app.post('/api/login', async (req, res) => {
    try {
        console.log('📥 Login request:', req.body.username);
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
        }

        let user = await Admin.findOne({ username: username.toLowerCase() });
        let userType = 'admin';

        if (!user) {
            user = await Student.findOne({ username: username.toLowerCase() });
            userType = 'student';
        }

        if (!user) {
            console.log('❌ User not found:', username);
            return res.status(401).json({ error: 'بيانات غير صحيحة' });
        }

        const hashedInputPassword = hashPassword(password);
        const isMatch = (hashedInputPassword === user.password);
        
        if (!isMatch) {
            console.log('❌ Password incorrect for:', username);
            return res.status(401).json({ error: 'بيانات غير صحيحة' });
        }

        console.log('✅ Login successful:', username);
        
        res.json({
            success: true,
            user: {
                username: user.username,
                fullName: user.fullName,
                type: userType,
                ...(user.studentCode && { id: user.studentCode })
            }
        });

    } catch (error) {
        console.error('🔥 Login error:', error);
        res.status(500).json({ error: 'خطأ في السيرفر: ' + error.message });
    }
});

// ====================== تسجيل طالب جديد ======================
app.post('/api/register-student', async (req, res) => {
    try {
        const { fullName, username, password, studentCode, phone, parentName, parentId } = req.body;

        if (!fullName || !username || !password || !studentCode) {
            return res.status(400).json({ error: 'البيانات ناقصة' });
        }

        const existingUser = await Student.findOne({ $or: [{ username }, { studentCode }] });
        if (existingUser) {
            return res.status(400).json({ error: 'المستخدم أو الكود موجود مسبقاً' });
        }

        const hashedPassword = hashPassword(password);
        
        const student = new Student({
            fullName,
            username: username.toLowerCase(),
            studentCode,
            password: hashedPassword,
            profile: { phone, parentName, parentId }
        });

        await student.save();
        res.json({ success: true, message: 'تم التسجيل بنجاح', username });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ====================== التحقق من اسم المستخدم ======================
app.post('/api/check-username', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'اسم المستخدم مطلوب' });
        }

        const [existingAdmins, existingStudents] = await Promise.all([
            Admin.findOne({ username }).lean(),
            Student.findOne({ username }).lean()
        ]);

        const isAvailable = !existingAdmins && !existingStudents;
        res.json({ available: isAvailable });
    } catch (error) {
        console.error('Error checking username:', error);
        res.status(500).json({ error: 'خطأ في التحقق من اسم المستخدم' });
    }
});

// ====================== المخالفات ======================
app.get('/api/violations', async (req, res) => {
    try {
        const violations = await Violation.find();
        res.json(violations);
    } catch (error) {
        console.error('Error fetching violations:', error);
        res.status(500).json({ error: 'خطأ في جلب المخالفات' });
    }
});

app.post('/api/violations', async (req, res) => {
    try {
        const newViolation = new Violation(req.body);
        await newViolation.save();
        res.json({ message: 'تم إضافة المخالفة', violation: newViolation });
    } catch (error) {
        console.error('Error adding violation:', error);
        res.status(500).json({ error: 'خطأ في إضافة المخالفة' });
    }
});

app.delete('/api/violations/:id', async (req, res) => {
    try {
        await Violation.findByIdAndDelete(req.params.id);
        res.json({ message: 'تم حذف المخالفة' });
    } catch (error) {
        console.error('Error deleting violation:', error);
        res.status(500).json({ error: 'خطأ في حذف المخالفة' });
    }
});

// ====================== الإشعارات ======================
app.get('/api/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find();
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'خطأ في جلب الإشعارات' });
    }
});

app.post('/api/notifications', async (req, res) => {
    try {
        const newNotification = new Notification(req.body);
        await newNotification.save();
        res.json({ message: 'تم إضافة الإشعار', notification: newNotification });
    } catch (error) {
        console.error('Error adding notification:', error);
        res.status(500).json({ error: 'خطأ في إضافة الإشعار' });
    }
});

app.delete('/api/notifications/:id', async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ message: 'تم حذف الإشعار' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'خطأ في حذف الإشعار' });
    }
});

// ====================== الاختبارات (Exams) ======================
app.post('/api/exams/check-code', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'كود الاختبار مطلوب' });
        const exam = await Exam.findOne({ code });
        res.json({ available: !exam });
    } catch (error) {
        res.status(500).json({ error: 'فشل في التحقق من الكود' });
    }
});

app.post('/api/exams', async (req, res) => {
    try {
        const { name, stage, code, duration, questions } = req.body;
        if (!name || !stage || !code || !duration || !questions || !Array.isArray(questions)) {
            return res.status(400).json({ error: 'البيانات غير مكتملة أو غير صحيحة' });
        }
        const exam = new Exam({ name, stage, code, duration, questions });
        await exam.save();
        res.json({ message: 'تم حفظ الاختبار', code });
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ error: 'كود الاختبار مستخدم مسبقاً' });
        } else {
            res.status(500).json({ error: `فشل في حفظ الاختبار: ${error.message}` });
        }
    }
});

app.get('/api/exams/:code', async (req, res) => {
    try {
        const code = decodeURIComponent(req.params.code);
        const exam = await Exam.findOne({ code });
        if (!exam) return res.status(404).json({ error: 'الاختبار غير موجود' });
        res.json(exam);
    } catch (error) {
        res.status(500).json({ error: `فشل في جلب الاختبار: ${error.message}` });
    }
});

app.post('/api/exams/submit', async (req, res) => {
    try {
        const { examCode, studentId, score } = req.body;
        const result = new ExamResult({ examCode, studentId, score });
        await result.save();
        res.json({ message: 'تم حفظ النتيجة' });
    } catch (error) {
        res.status(500).json({ error: 'فشل في إرسال النتيجة' });
    }
});

app.get('/api/exams/:code/results', async (req, res) => {
    try {
        const code = decodeURIComponent(req.params.code);
        const results = await ExamResult.find({ examCode: code });
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: `فشل في جلب نتائج الاختبار: ${error.message}` });
    }
});

// ====================== تحليل PDF ======================
app.post('/api/analyze-pdf', async (req, res) => {
    try {
        const { pdfData } = req.body;
        if (!pdfData) {
            return res.status(400).json({ error: 'بيانات PDF غير صالحة' });
        }

        const buffer = Buffer.from(pdfData, 'base64');
        const data = await pdfParse(buffer);
        
        res.json({ 
            message: 'تم تحليل PDF بنجاح', 
            text: data.text.substring(0, 500),
            pageCount: data.numpages 
        });
    } catch (error) {
        console.error('PDF analysis error:', error);
        res.status(500).json({ error: 'خطأ في تحليل الملف: ' + error.message });
    }
});

// ====================== نور AI ======================
app.post('/api/nour', async (req, res) => {
    try {
        const { prompt } = req.body;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!prompt || prompt.trim() === '') {
            return res.json({ reply: "اكتب حاجة الأول يا وحش!" });
        }

        if (!GEMINI_API_KEY) {
            return res.json({ reply: "نور نايمة دلوقتي يا بطل… كلمني بعد شوية" });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{ text: `أنت نور، مساعد ذكي مصري خفيف الدم. السؤال: ${prompt}` }]
                    }],
                    generationConfig: { temperature: 0.9, maxOutputTokens: 1000 }
                })
            }
        );

        const result = await response.json();
        const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || "معلش يا وحش… جرب تاني";

        res.json({ reply: reply.trim() });
    } catch (err) {
        console.error("Nour error:", err.message);
        res.json({ reply: "النت وقع يا أسطورة… جرب تاني" });
    }
});

// ====================== إنشاء مدير تجريبي ======================
app.post('/api/create-test-admin', async (req, res) => {
    try {
        const hashedPassword = hashPassword('admin123');
        
        const existingAdmin = await Admin.findOne({ username: 'admin' });
        if (existingAdmin) {
            return res.json({ message: 'المدير موجود مسبقاً', username: 'admin', password: 'admin123' });
        }
        
        const admin = new Admin({
            fullName: 'مدير النظام',
            username: 'admin',
            password: hashedPassword,
            profile: { phone: '', email: '' }
        });
        
        await admin.save();
        res.json({ message: 'تم إنشاء المدير بنجاح', username: 'admin', password: 'admin123' });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ error: error.message });
    }
});

// ====================== API Routes - الحضور والغياب ======================

// جلب سجل الحضور لكل الطلاب في تاريخ معين
app.get('/api/attendance/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const attendance = await Attendance.find({ date });
        res.json(attendance);
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ error: 'خطأ في جلب بيانات الحضور' });
    }
});

// جلب سجل الحضور لطالب معين
app.get('/api/attendance/student/:studentCode', async (req, res) => {
    try {
        const { studentCode } = req.params;
        const attendance = await Attendance.find({ studentCode });
        res.json(attendance);
    } catch (error) {
        console.error('Error fetching student attendance:', error);
        res.status(500).json({ error: 'خطأ في جلب حضور الطالب' });
    }
});

// تسجيل حضور/غياب لطالب
app.post('/api/attendance', async (req, res) => {
    try {
        const { studentCode, studentName, date, status, note, recordedBy } = req.body;
        
        // التحقق من وجود سجل لنفس الطالب في نفس التاريخ
        const existing = await Attendance.findOne({ studentCode, date });
        
        if (existing) {
            // تحديث السجل الموجود
            existing.status = status;
            existing.note = note || '';
            await existing.save();
            return res.json({ message: 'تم تحديث الحضور بنجاح', attendance: existing });
        }
        
        // إنشاء سجل جديد
        const attendance = new Attendance({
            studentCode,
            studentName,
            date,
            status,
            note: note || '',
            recordedBy: recordedBy || 'admin'
        });
        
        await attendance.save();
        res.json({ message: 'تم تسجيل الحضور بنجاح', attendance });
    } catch (error) {
        console.error('Error saving attendance:', error);
        res.status(500).json({ error: 'خطأ في تسجيل الحضور' });
    }
});

// تسجيل حضور لعدة طلاب في وقت واحد (لكامل الفصل)
app.post('/api/attendance/bulk', async (req, res) => {
    try {
        const { date, students, recordedBy } = req.body;
        
        let saved = 0;
        let updated = 0;
        
        for (const student of students) {
            const existing = await Attendance.findOne({ studentCode: student.code, date });
            
            if (existing) {
                existing.status = student.status;
                existing.note = student.note || '';
                await existing.save();
                updated++;
            } else {
                const attendance = new Attendance({
                    studentCode: student.code,
                    studentName: student.name,
                    date,
                    status: student.status,
                    note: student.note || '',
                    recordedBy: recordedBy || 'admin'
                });
                await attendance.save();
                saved++;
            }
        }
        
        res.json({ message: `تم تسجيل الحضور: ${saved} جديد، ${updated} تحديث`, saved, updated });
    } catch (error) {
        console.error('Error saving bulk attendance:', error);
        res.status(500).json({ error: 'خطأ في تسجيل الحضور' });
    }
});

// إحصائيات الحضور لطالب
app.get('/api/attendance/stats/:studentCode', async (req, res) => {
    try {
        const { studentCode } = req.params;
        const attendance = await Attendance.find({ studentCode });
        
        const total = attendance.length;
        const present = attendance.filter(a => a.status === 'present').length;
        const absent = attendance.filter(a => a.status === 'absent').length;
        const late = attendance.filter(a => a.status === 'late').length;
        
        const percentage = total > 0 ? (present / total) * 100 : 0;
        
        res.json({
            studentCode,
            total,
            present,
            absent,
            late,
            percentage: percentage.toFixed(1)
        });
    } catch (error) {
        console.error('Error fetching attendance stats:', error);
        res.status(500).json({ error: 'خطأ في جلب إحصائيات الحضور' });
    }
});

// ====================== Error Handling ======================
app.use((err, req, res, next) => {
    console.error('❌ Unhandled Error:', err);
    res.status(500).json({
        error: 'حدث خطأ داخلي في السيرفر',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ====================== التصدير لـ Vercel (مهم جداً) ======================
// ✅ هذا السطر هو المطلوب لـ Vercel - لا تستخدم app.listen()
module.exports = app;
