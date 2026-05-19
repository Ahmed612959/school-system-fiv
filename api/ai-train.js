const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

// ====================== إعدادات التخزين ======================
const TRAINING_DIR = path.join(__dirname, 'training-data');

// التأكد من وجود مجلد التدريب
if (!fs.existsSync(TRAINING_DIR)) {
    fs.mkdirSync(TRAINING_DIR, { recursive: true });
    console.log('📁 تم إنشاء مجلد training-data');
}

// ====================== دوال استخراج النص من الملفات ======================

// استخراج النص من PDF
async function extractTextFromPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    } catch (error) {
        console.error('PDF extraction error:', error);
        throw new Error('فشل في قراءة ملف PDF');
    }
}

// استخراج النص من Word (DOCX)
async function extractTextFromWord(filePath) {
    try {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    } catch (error) {
        console.error('Word extraction error:', error);
        throw new Error('فشل في قراءة ملف Word');
    }
}

// استخراج النص من Excel (XLSX, XLS)
function extractTextFromExcel(filePath) {
    try {
        const workbook = XLSX.readFile(filePath);
        let text = '';
        
        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            data.forEach(row => {
                text += row.filter(cell => cell).join(' ') + '\n';
            });
        });
        
        return text;
    } catch (error) {
        console.error('Excel extraction error:', error);
        throw new Error('فشل في قراءة ملف Excel');
    }
}

// استخراج النص من TXT
function extractTextFromTXT(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        console.error('TXT extraction error:', error);
        throw new Error('فشل في قراءة ملف TXT');
    }
}

// ====================== دوال التخزين والتدريب ======================

// حفظ ملف مدرب
function saveTrainingFile(fileName, content) {
    try {
        const safeFileName = fileName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
        const filePath = path.join(TRAINING_DIR, `${safeFileName}.json`);
        
        const data = {
            id: Date.now(),
            name: fileName,
            content: content,
            size: content.length,
            timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`✅ تم حفظ: ${fileName}`);
        return data;
    } catch (error) {
        console.error('Error saving training file:', error);
        throw new Error('فشل في حفظ ملف التدريب');
    }
}

// تحميل جميع الملفات المدربة
function loadTrainingFiles() {
    const trainingFiles = [];
    
    if (!fs.existsSync(TRAINING_DIR)) {
        return trainingFiles;
    }
    
    const files = fs.readdirSync(TRAINING_DIR);
    
    for (const file of files) {
        if (file.endsWith('.json')) {
            try {
                const filePath = path.join(TRAINING_DIR, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                trainingFiles.push(data);
            } catch (error) {
                console.error(`Error loading file ${file}:`, error);
            }
        }
    }
    
    console.log(`📚 تم تحميل ${trainingFiles.length} ملف تدريب`);
    return trainingFiles;
}

// حذف جميع بيانات التدريب
function clearAllData() {
    try {
        const files = fs.readdirSync(TRAINING_DIR);
        for (const file of files) {
            if (file.endsWith('.json')) {
                fs.unlinkSync(path.join(TRAINING_DIR, file));
            }
        }
        console.log('🗑️ تم حذف جميع بيانات التدريب');
        return { success: true, message: 'تم حذف جميع بيانات التدريب' };
    } catch (error) {
        console.error('Error clearing data:', error);
        return { success: false, message: error.message };
    }
}

// ====================== الدالة الرئيسية للتدريب ======================

async function trainOnFile(filePath, originalName) {
    try {
        // التحقق من وجود الملف
        if (!fs.existsSync(filePath)) {
            throw new Error('الملف غير موجود');
        }
        
        // تحديد نوع الملف واستخراج النص
        const ext = path.extname(filePath).toLowerCase();
        let text = '';
        let fileType = '';
        
        switch (ext) {
            case '.pdf':
                text = await extractTextFromPDF(filePath);
                fileType = 'PDF';
                break;
            case '.docx':
                text = await extractTextFromWord(filePath);
                fileType = 'Word';
                break;
            case '.xlsx':
            case '.xls':
                text = extractTextFromExcel(filePath);
                fileType = 'Excel';
                break;
            case '.txt':
                text = extractTextFromTXT(filePath);
                fileType = 'نصي';
                break;
            default:
                throw new Error(`نوع الملف غير مدعوم: ${ext}. الأنواع المدعومة: PDF, DOCX, XLSX, TXT`);
        }
        
        // التحقق من صحة النص المستخرج
        if (!text || text.trim().length === 0) {
            throw new Error('الملف لا يحتوي على نص قابل للقراءة');
        }
        
        if (text.length < 50) {
            throw new Error('الملف لا يحتوي على نص كافي للتدريب (يحتاج على الأقل 50 حرف)');
        }
        
        // تنظيف النص
        text = text.replace(/\s+/g, ' ').trim();
        
        // حفظ الملف المدرب
        const fileName = originalName.replace(/\.[^/.]+$/, '');
        saveTrainingFile(fileName, text);
        
        // حساب عدد الأجزاء
        const chunksCount = Math.ceil(text.length / 500);
        
        console.log(`✅ تم تدريب الذكاء الاصطناعي على: ${originalName} (${chunksCount} جزء)`);
        
        return {
            success: true,
            fileName: originalName,
            chunksCount: chunksCount,
            fileType: fileType,
            textLength: text.length
        };
        
    } catch (error) {
        console.error(`Error training on file ${originalName}:`, error.message);
        return {
            success: false,
            fileName: originalName,
            error: error.message
        };
    }
}

// ====================== دوال مساعدة ======================

// جلب معلومات عن الملفات المدربة
function getTrainingInfo() {
    const files = loadTrainingFiles();
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    
    return {
        fileCount: files.length,
        totalSize: totalSize,
        lastUpdate: files.length > 0 ? files[files.length - 1].timestamp : null,
        files: files.map(f => ({ name: f.name, size: f.size, date: f.timestamp }))
    };
}

// تصدير الدوال
module.exports = {
    trainOnFile,
    clearAllData,
    loadTrainingFiles,
    getTrainingInfo,
    extractTextFromPDF,
    extractTextFromWord,
    extractTextFromExcel,
    extractTextFromTXT
};
