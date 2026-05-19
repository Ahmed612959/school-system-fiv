const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const { pipeline } = require('@xenova/transformers');

// ====================== إعدادات التخزين ======================
const VECTOR_DIR = path.join(__dirname, 'vector-store');
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');

if (!fs.existsSync(VECTOR_DIR)) fs.mkdirSync(VECTOR_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ====================== نموذج التضمين (Embedding) ======================
let embeddingModel = null;

async function getEmbeddingModel() {
    if (!embeddingModel) {
        console.log('🧠 جاري تحميل نموذج الذكاء الاصطناعي...');
        embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('✅ تم تحميل النموذج بنجاح');
    }
    return embeddingModel;
}

// ====================== استخراج النص من الملفات ======================
async function extractTextFromPDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
}

async function extractTextFromWord(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
}

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

function extractTextFromTXT(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

// ====================== تقسيم النص الذكي ======================
function smartChunkText(text, maxChunkSize = 500, overlap = 50) {
    // تنظيف النص
    text = text.replace(/\s+/g, ' ').trim();
    
    const chunks = [];
    const sentences = text.match(/[^.!?؟!]+[.!?؟!]+/g) || [text];
    
    let currentChunk = '';
    let overlapText = '';
    
    for (const sentence of sentences) {
        const sentenceTrimmed = sentence.trim();
        
        if (currentChunk.length + sentenceTrimmed.length > maxChunkSize) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                // حفظ النص المتداخل (overlap)
                const words = currentChunk.split(' ');
                overlapText = words.slice(-Math.floor(overlap / 10)).join(' ');
                currentChunk = overlapText + ' ' + sentenceTrimmed;
            } else {
                currentChunk = sentenceTrimmed;
            }
        } else {
            currentChunk += (currentChunk ? ' ' : '') + sentenceTrimmed;
        }
    }
    
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks.filter(c => c.length > 20);
}

// ====================== حساب التضمين والتخزين ======================
async function getEmbedding(text) {
    const model = await getEmbeddingModel();
    const result = await model(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
}

async function saveChunk(chunk, fileName, index) {
    const embedding = await getEmbedding(chunk.text);
    const chunkData = {
        id: `${fileName}_${Date.now()}_${index}`,
        text: chunk.text,
        embedding: embedding,
        source: fileName,
        timestamp: new Date().toISOString(),
        metadata: chunk.metadata || {}
    };
    
    const vectorFile = path.join(VECTOR_DIR, `${fileName}.json`);
    let existingChunks = [];
    
    if (fs.existsSync(vectorFile)) {
        existingChunks = JSON.parse(fs.readFileSync(vectorFile, 'utf-8'));
    }
    
    existingChunks.push(chunkData);
    fs.writeFileSync(vectorFile, JSON.stringify(existingChunks, null, 2));
    return chunkData;
}

// ====================== دالة التدريب الرئيسية ======================
async function trainOnFile(filePath, originalName) {
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
        
        if (!text || text.length < 50) {
            throw new Error('الملف لا يحتوي على نص كافي للتدريب (يحتاج 50 حرف على الأقل)');
        }
        
        const fileName = originalName.replace(/\.[^/.]+$/, '');
        const chunks = smartChunkText(text);
        
        let savedCount = 0;
        for (let i = 0; i < chunks.length; i++) {
            await saveChunk({ text: chunks[i], metadata: { index: i } }, fileName, i);
            savedCount++;
        }
        
        return { success: true, chunksCount: savedCount, fileName: originalName };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function clearAllData() {
    const files = fs.readdirSync(VECTOR_DIR);
    for (const file of files) {
        if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(VECTOR_DIR, file));
        }
    }
    return { success: true, message: 'تم حذف جميع بيانات التدريب' };
}

module.exports = { trainOnFile, clearAllData, getEmbedding };
