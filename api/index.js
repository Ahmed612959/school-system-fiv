require('dotenv').config();
// أضف السطرين دول
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Found' : '❌ Not found');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');
const pdfParse = require('pdf-parse');
const webpush = require('web-push');

const app = express();

// ====================== التكوين الثابت ======================
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production-2024';
const SALT_ROUNDS = 12; // زيادة جولات التشفير للأمان
const COOKIE_OPTIONS = {
    httpOnly: true,        // لا يمكن الوصول من JavaScript
    secure: process.env.NODE_ENV === 'production', // HTTPS فقط في الإنتاج
    sameSite: 'strict',    // منع CSRF
    maxAge: 24 * 60 * 60 * 1000, // 24 ساعة
    path: '/'
};

// ====================== HELMET - حماية HTTP Headers ======================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'same-origin' }
}));

// ====================== Rate Limiting ======================
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 5, // 5 محاولات فقط
    message: { error: 'محاولات كثيرة جداً. حاول مرة أخرى بعد 15 دقيقة.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});

// ====================== MIDDLEWARE ======================
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use('/api/', generalLimiter);

// Middleware للصفحات الثابتة - منع cache
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Surrogate-Control', 'no-store');
    }
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
    index: false,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.set('Cache-Control', 'no-store');
        }
    }
}));

// ====================== دوال التشفير والمصادقة ======================
async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// Middleware للتحقق من JWT من Cookie
function authenticateToken(req, res, next) {
    const token = req.cookies?.authToken;
    
    if (!token) {
        // إذا كان الطلب API
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'غير مصرح، يرجى تسجيل الدخول.' });
        }
        // إذا كان الطلب صفحة HTML
        return res.redirect(`/login.html?redirect=${encodeURIComponent(req.originalUrl)}`);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.clearCookie('authToken');
            if (req.path.startsWith('/api/')) {
                return res.status(403).json({ error: 'انتهت الجلسة.' });
            }
            return res.redirect('/login.html?expired=true');
        }
        req.user = user;
        next();
    });
}

// Middleware للتحقق من صلاحيات الأدمن
function requireAdmin(req, res, next) {
    if (!req.user || req.user.type !== 'admin') {
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({ error: 'غير مصرح! هذه العملية تتطلب صلاحيات المدير.' });
        }
        return res.status(403).sendFile(path.join(__dirname, 'public', '403.html'));
    }
    next();
}

// ====================== النماذج (Schemas) ======================
// ... (كل النماذج كما هي) ...

const adminSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    profile: { phone: String, email: String },
    lastLogin: Date,
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: Date
});

const studentSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    studentCode: { type: String, required: true, unique: true },
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    grade: { type: String, enum: ['first', 'second', 'third'], default: 'first' },
    semester: String,
    subjects: Array,
    profile: {
        phone: String,
        parentName: String,
        parentId: String
    },
    lastLogin: Date,
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: Date
}, { timestamps: true });

// باقي النماذج...
const violationSchema = new mongoose.Schema({
    studentId: String, type: String, reason: String, penalty: String,
    parentSummons: Boolean, date: String
});

const notificationSchema = new mongoose.Schema({
    text: String, date: String
});

const weeklyQuizSchema = new mongoose.Schema({
    weekNumber: { type: Number, required: true },
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctIndex: { type: Number, required: true },
    winners: [{
        studentId: String, username: String, fullName: String,
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
        options: [String], correctAnswer: String, correctAnswers: [String]
    }]
});

const examResultSchema = new mongoose.Schema({
    examCode: { type: String, required: true },
    studentId: { type: String, required: true },
    score: { type: Number, required: true },
    completionTime: { type: Date, default: Date.now }
});

const attendanceSchema = new mongoose.Schema({
    studentCode: { type: String, required: true },
    studentName: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ['present', 'absent', 'late'], default: 'present' },
    note: { type: String, default: '' },
    recordedBy: { type: String, default: '' }
});

const subscriptionSchema = new mongoose.Schema({
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: String, auth: String },
    userId: String, userType: String,
    createdAt: { type: Date, default: Date.now }
});

// إنشاء النماذج
const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
const Student = mongoose.models.Student || mongoose.model('Student', studentSchema);
const Violation = mongoose.models.Violation || mongoose.model('Violation', violationSchema);
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
const WeeklyQuiz = mongoose.models.WeeklyQuiz || mongoose.model('WeeklyQuiz', weeklyQuizSchema);
const Exam = mongoose.models.Exam || mongoose.model('Exam', examSchema);
const ExamResult = mongoose.models.ExamResult || mongoose.model('ExamResult', examResultSchema);
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);

// ====================== الاتصال بقاعدة البيانات ======================
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set!');
} else {
    mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 60000,
        connectTimeoutMS: 30000,
    })
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err.message));
}

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

// ====================== ROUTES - HTML Pages Protection ======================

// صفحة تسجيل الدخول - متاحة للجميع
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// صفحة التسجيل - متاحة للجميع
app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

// صفحة الرئيسية - تتطلب تسجيل الدخول فقط
app.get('/Home.html', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Home.html'));
});

// صفحة الأدمن - تتطلب تسجيل دخول + صلاحيات أدمن
app.get('/admin.html', authenticateToken, requireAdmin, (req, res) => {
    // إرسال بيانات المستخدم عبر Header مخصص
    res.set('X-User-Data', JSON.stringify({
        username: req.user.username,
        fullName: req.user.fullName,
        type: req.user.type
    }));
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// أي صفحة HTML أخرى تتطلب تسجيل الدخول
app.get('*.html', authenticateToken, (req, res, next) => {
    const publicPages = ['login.html', 'signup.html', 'parent-login.html'];
    if (publicPages.includes(req.path.replace('/', ''))) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public', req.path));
});

// ====================== API Routes ======================

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'ok', 
        mongodb_status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        message: 'API is working!' 
    });
});

// ====================== تسجيل الدخول (مع HttpOnly Cookie) ======================
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
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
            // تأخير الرد لمنع معرفة إذا كان المستخدم موجود
            await new Promise(resolve => setTimeout(resolve, 1000));
            return res.status(401).json({ error: 'بيانات غير صحيحة' });
        }

        // التحقق من قفل الحساب
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
            return res.status(423).json({ 
                error: `الحساب مقفل. حاول مرة أخرى بعد ${minutesLeft} دقيقة.` 
            });
        }

        const isMatch = await comparePassword(password, user.password);
        
        if (!isMatch) {
            // زيادة عداد المحاولات الفاشلة
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            
            // قفل الحساب بعد 5 محاولات فاشلة
            if (user.loginAttempts >= 5) {
                user.lockedUntil = new Date(Date.now() + 30 * 60000); // 30 دقيقة
                user.loginAttempts = 0;
            }
            
            await user.save();
            await new Promise(resolve => setTimeout(resolve, 1000));
            return res.status(401).json({ error: 'بيانات غير صحيحة' });
        }

        // إعادة تعيين عداد المحاولات عند نجاح الدخول
        user.loginAttempts = 0;
        user.lockedUntil = null;
        user.lastLogin = new Date();
        await user.save();

        // إنشاء JWT
        const tokenPayload = {
            id: user.studentCode || user.username,
            username: user.username,
            fullName: user.fullName,
            type: userType
        };
        
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        // تعيين Cookie آمن
        res.cookie('authToken', token, COOKIE_OPTIONS);

        // إرجاع بيانات المستخدم فقط (بدون token في body)
        res.json({
            success: true,
            user: tokenPayload
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'خطأ في السيرفر' });
    }
});

// ====================== تسجيل الخروج ======================
app.post('/api/logout', authenticateToken, (req, res) => {
    res.clearCookie('authToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

// ====================== API للتحقق من الجلسة ======================
app.get('/api/check-session', authenticateToken, (req, res) => {
    res.json({
        authenticated: true,
        user: req.user
    });
});

// ====================== الأدمنز (محمية) ======================
app.get('/api/admins', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const admins = await Admin.find().select('-password -loginAttempts -lockedUntil');
        res.json(admins);
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في جلب الأدمنز' }); 
    }
});

app.post('/api/admins', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { fullName, username, password } = req.body;
        
        if (!fullName || !username || !password) {
            return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
        }
        
        const existingAdmin = await Admin.findOne({ username });
        if (existingAdmin) {
            return res.status(400).json({ error: 'اسم المستخدم موجود بالفعل' });
        }
        
        const hashedPassword = await hashPassword(password);
        const newAdmin = new Admin({ 
            fullName, 
            username, 
            password: hashedPassword 
        });
        await newAdmin.save();
        
        res.json({ 
            message: 'تم إضافة الأدمن بنجاح', 
            admin: { fullName, username } 
        });
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في إضافة الأدمن' }); 
    }
});

app.delete('/api/admins/:username', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const admins = await Admin.find();
        if (admins.length <= 1) {
            return res.status(400).json({ error: 'لا يمكن حذف آخر أدمن متبقي' });
        }
        
        await Admin.deleteOne({ username: req.params.username });
        res.json({ message: 'تم حذف الأدمن بنجاح' });
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في حذف الأدمن' }); 
    }
});

// ====================== الطلاب (محمية) ======================
app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const students = await Student.find().select('-password -loginAttempts -lockedUntil');
        res.json(students);
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في جلب الطلاب' }); 
    }
});

app.get('/api/students/by-grade/:grade', authenticateToken, async (req, res) => {
    try {
        const { grade } = req.params;
        const students = await Student.find({ grade }).select('-password');
        res.json(students);
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في جلب الطلاب حسب الصف' }); 
    }
});

app.post('/api/students', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { fullName, id, subjects, semester } = req.body;
        
        if (!fullName || !id) {
            return res.status(400).json({ error: 'الاسم والرقم القومي مطلوبان' });
        }
        
        const existingAdmins = await Admin.find();
        const existingStudents = await Student.find();
        const username = generateUniqueUsername(fullName, id, [...existingAdmins, ...existingStudents]);
        const originalPassword = generatePassword(fullName);
        const hashedPassword = await hashPassword(originalPassword);
        
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
        
        res.json({ 
            message: 'تم إضافة الطالب بنجاح', 
            student: { 
                fullName, 
                username, 
                studentCode: id,
                password: originalPassword // كلمة المرور تُرسل مرة واحدة فقط
            } 
        });
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في إضافة الطالب: ' + error.message }); 
    }
});

app.put('/api/students/:studentCode', authenticateToken, requireAdmin, async (req, res) => {
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
            updateData.password = await hashPassword(password);
        }
        
        const updated = await Student.findOneAndUpdate(
            { studentCode: req.params.studentCode }, 
            updateData, 
            { new: true }
        ).select('-password -loginAttempts -lockedUntil');
        
        if (!updated) {
            return res.status(404).json({ error: 'الطالب غير موجود' });
        }
        
        res.json({ message: 'تم تحديث بيانات الطالب', student: updated });
    } catch (error) { 
        res.status(500).json({ error: 'فشل في التحديث: ' + error.message }); 
    }
});

app.delete('/api/students/:studentCode', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const student = await Student.findOneAndDelete({ studentCode: req.params.studentCode });
        if (!student) {
            return res.status(404).json({ error: 'الطالب غير موجود' });
        }
        
        // حذف البيانات المرتبطة
        await Promise.all([
            Violation.deleteMany({ studentId: req.params.studentCode }),
            Attendance.deleteMany({ studentCode: req.params.studentCode }),
            ExamResult.deleteMany({ studentId: req.params.studentCode })
        ]);
        
        res.json({ message: 'تم حذف الطالب وجميع بياناته بنجاح' });
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في حذف الطالب' }); 
    }
});

// ====================== تسجيل طالب جديد (عامة مع rate limiting) ======================
app.post('/api/register-student', rateLimit({
    windowMs: 60 * 60 * 1000, // ساعة
    max: 3 // 3 محاولات فقط
}), async (req, res) => {
    try {
        const { fullName, username, password, studentCode, grade, phone, parentName, parentId } = req.body;
        
        if (!fullName || !username || !password || !studentCode) {
            return res.status(400).json({ error: 'جميع الحقول المطلوبة يجب ملؤها' });
        }

        // التحقق من قوة كلمة المرور
        if (password.length < 8) {
            return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
        }

        const existingUser = await Student.findOne({ 
            $or: [{ username: username.toLowerCase() }, { studentCode }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ error: 'اسم المستخدم أو كود الطالب موجود مسبقاً' });
        }

        const hashedPassword = await hashPassword(password);
        const student = new Student({
            fullName, 
            username: username.toLowerCase(), 
            studentCode,
            grade: grade || 'first', 
            password: hashedPassword,
            profile: { phone, parentName, parentId }
        });
        
        await student.save();
        
        res.json({ 
            success: true, 
            message: 'تم التسجيل بنجاح! يمكنك الآن تسجيل الدخول.',
            username 
        });
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في التسجيل: ' + error.message }); 
    }
});

// ====================== إنشاء مدير تجريبي (للتطوير فقط) ======================
app.post('/api/create-test-admin', async (req, res) => {
    try {
        // التحقق من البيئة
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'هذه الميزة غير متاحة في بيئة الإنتاج' });
        }

        const existingAdmin = await Admin.findOne({ username: 'admin' });
        if (existingAdmin) {
            return res.json({ 
                message: 'المدير موجود مسبقاً', 
                username: 'admin',
                hint: 'استخدم كلمة المرور المعينة سابقاً'
            });
        }
        
        // كلمة مرور قوية وعشوائية
        const plainPassword = 'Adm@' + Math.random().toString(36).slice(-10) + '!';
        const admin = new Admin({
            fullName: 'مدير النظام',
            username: 'admin',
            password: await hashPassword(plainPassword)
        });
        
        await admin.save();
        
        console.log('✅ Test admin created - Username: admin, Password:', plainPassword);
        
        res.json({ 
            message: 'تم إنشاء المدير التجريبي بنجاح', 
            username: 'admin', 
            password: plainPassword 
        });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// ====================== المخالفات والإشعارات (محمية) ======================
app.get('/api/violations', authenticateToken, async (req, res) => {
    try { 
        const violations = await Violation.find();
        res.json(violations); 
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في جلب المخالفات' }); 
    }
});

app.post('/api/violations', authenticateToken, requireAdmin, async (req, res) => {
    try { 
        const newViolation = new Violation(req.body);
        await newViolation.save();
        res.json({ message: 'تم إضافة المخالفة', violation: newViolation }); 
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في إضافة المخالفة' }); 
    }
});

app.delete('/api/violations/:id', authenticateToken, requireAdmin, async (req, res) => {
    try { 
        await Violation.findByIdAndDelete(req.params.id);
        res.json({ message: 'تم حذف المخالفة' }); 
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في حذف المخالفة' }); 
    }
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
    try { 
        const notifications = await Notification.find().sort({ date: -1 });
        res.json(notifications); 
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في جلب الإشعارات' }); 
    }
});

app.post('/api/notifications', authenticateToken, requireAdmin, async (req, res) => {
    try { 
        const newNotification = new Notification(req.body);
        await newNotification.save();
        res.json({ message: 'تم إضافة الإشعار', notification: newNotification }); 
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في إضافة الإشعار' }); 
    }
});

app.delete('/api/notifications/:id', authenticateToken, requireAdmin, async (req, res) => {
    try { 
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ message: 'تم حذف الإشعار' }); 
    } catch (error) { 
        res.status(500).json({ error: 'خطأ في حذف الإشعار' }); 
    }
});

// ====================== 404 Handler ======================
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ====================== Error Handler ======================
app.use((err, req, res, next) => {
    console.error('❌ Unhandled Error:', err);
    
    if (req.path.startsWith('/api/')) {
        return res.status(500).json({ 
            error: 'حدث خطأ داخلي في السيرفر',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
    
    res.status(500).sendFile(path.join(__dirname, 'public', '500.html'));
});

module.exports = app;
