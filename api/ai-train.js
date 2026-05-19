const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// مجلد تخزين البيانات
const VECTOR_DIR = path.join(__dirname, '../vector-store');

// التأكد من وجود المجلد
if (!fs.existsSync(VECTOR_DIR)) fs.mkdirSync(VECTOR_DIR, { recursive: true });

// استخراج النص من PDF
async function extractTextFromPDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
}

// استخراج النص من TXT
function extractTextFromTXT(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

// تقسيم النص إلى أجزاء صغيرة
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

// حفظ الأجزاء
function saveChunks(chunks, fileName) {
    const vectorFile = path.join(VECTOR_DIR, `${fileName}.json`);
    let existingChunks = [];
    
    if (fs.existsSync(vectorFile)) {
        existingChunks = JSON.parse(fs.readFileSync(vectorFile, 'utf-8'));
    }
    
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
        } else if (ext === '.txt') {
            text = extractTextFromTXT(filePath);
        } else {
            throw new Error(`نوع الملف غير مدعوم حالياً: ${ext}. استخدم PDF أو TXT.`);
        }
        
        const chunks = chunkText(text);
        const addedCount = saveChunks(chunks, fileName.replace(/\.[^/.]+$/, ''));
        
        return { success: true, chunksCount: addedCount, fileName };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = { trainOnFile };
