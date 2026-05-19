const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

// مجلد رفع الملفات
const UPLOAD_DIR = path.join(__dirname, '../public/uploads');
const VECTOR_DIR = path.join(__dirname, '../vector-store');

// التأكد من وجود المجلدات
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(VECTOR_DIR)) fs.mkdirSync(VECTOR_DIR, { recursive: true });

// استخراج النص من PDF
async function extractTextFromPDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
}

// استخراج النص من Word
async function extractTextFromWord(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
}

// استخراج النص من Excel
function extractTextFromExcel(filePath) {
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
}

// استخراج النص من TXT
function extractTextFromTXT(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

// تقسيم النص إلى أجزاء صغيرة (chunks)
function chunkText(text, chunkSize = 500) {
    const sentences = text.split(/[.!?؟!]\s+/);
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > chunkSize) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}

// حفظ الأجزاء (vectores) في ملف
function saveChunks(chunks, fileName) {
    const vectorFile = path.join(VECTOR_DIR, `${fileName}.json`);
    let existingChunks = [];
    
    if (fs.existsSync(vectorFile)) {
        existingChunks = JSON.parse(fs.readFileSync(vectorFile, 'utf-8'));
    }
    
    // إضافة الأجزاء الجديدة مع رقم المعرف
    const newChunks = chunks.map((text, index) => ({
        id: `${fileName}_${Date.now()}_${index}`,
        text: text,
        source: fileName,
        timestamp: new Date().toISOString()
    }));
    
    const allChunks = [...existingChunks, ...newChunks];
    fs.writeFileSync(vectorFile, JSON.stringify(allChunks, null, 2));
    return newChunks.length;
}

// دالة رئيسية للتدريب
async function trainOnFile(filePath, fileName) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        let text = '';
        
        if (ext === '.pdf') {
            text = await extractTextFromPDF(filePath);
        } else if (ext === '.docx') {
            text = await extractTextFromWord(filePath);
        } else if (ext === '.xlsx' || ext === '.xls') {
            text = extractTextFromExcel(filePath);
        } else if (ext === '.txt') {
            text = extractTextFromTXT(filePath);
        } else {
            throw new Error(`نوع الملف غير مدعوم: ${ext}`);
        }
        
        const chunks = chunkText(text);
        const addedCount = saveChunks(chunks, fileName.replace(/\.[^/.]+$/, ''));
        
        return { success: true, chunksCount: addedCount, fileName };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = { trainOnFile, extractTextFromPDF, extractTextFromWord, extractTextFromExcel, chunkText, saveChunks };
