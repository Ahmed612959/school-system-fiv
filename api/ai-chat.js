const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const axios = require('axios');

// ====================== إعدادات التخزين ======================
const TRAINING_DIR = path.join(__dirname, 'training-data');
if (!fs.existsSync(TRAINING_DIR)) fs.mkdirSync(TRAINING_DIR, { recursive: true });

let trainingFiles = [];

// تحميل الملفات المدربة
function loadTrainingFiles() {
    if (!fs.existsSync(TRAINING_DIR)) return [];
    const files = fs.readdirSync(TRAINING_DIR);
    trainingFiles = [];
    for (const file of files) {
        if (file.endsWith('.json')) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(TRAINING_DIR, file), 'utf-8'));
                trainingFiles.push(data);
            } catch(e) {}
        }
    }
    console.log(`📚 تم تحميل ${trainingFiles.length} ملف تدريب`);
    return trainingFiles;
}

// البحث في الملفات المدربة
function searchInTraining(query) {
    const results = [];
    for (const file of trainingFiles) {
        const lines = file.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                const context = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
                results.push({
                    fileName: file.name,
                    context: context,
                    score: 1
                });
                break;
            }
        }
    }
    return results;
}

// استخراج النص من الملفات
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

// حفظ ملف مدرب
function saveTrainingFile(fileName, content) {
    const filePath = path.join(TRAINING_DIR, `${fileName}.json`);
    const data = {
        id: Date.now(),
        name: fileName,
        content: content,
        timestamp: new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    trainingFiles.push(data);
    return data;
}

// تدريب على ملف
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
            throw new Error('الملف لا يحتوي على نص كافي للتدريب');
        }
        
        const fileName = originalName.replace(/\.[^/.]+$/, '');
        saveTrainingFile(fileName, text);
        
        return { success: true, chunksCount: Math.ceil(text.length / 500), fileName: originalName };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// حذف جميع البيانات
function clearAllData() {
    const files = fs.readdirSync(TRAINING_DIR);
    for (const file of files) {
        if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(TRAINING_DIR, file));
        }
    }
    trainingFiles = [];
    return { success: true, message: 'تم حذف جميع بيانات التدريب' };
}

// ====================== استخدام DeepSeek API ======================
const DEEPSEEK_API_KEY = 'sk-b8d30e8ccf95428796c4bea23ab7fd55';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

async function askDeepSeek(question, context) {
    try {
        const systemPrompt = `أنت مساعد ذكي لمعهد رعاية الضبعية للتمريض.
رد باللغة العربية الفصحى أو العامية المصرية.
كن دقيقاً ومفيداً وودوداً.

المعلومات المتوفرة عن المعهد:
${context || "لا توجد معلومات محددة عن هذا السؤال في قاعدة المعهد. استخدم معرفتك العامة للإجابة."}`;

        const response = await axios.post(DEEPSEEK_API_URL, {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question }
            ],
            temperature: 0.7,
            max_tokens: 1000,
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('DeepSeek API error:', error.response?.data || error.message);
        return "⚠️ عذراً، حدث خطأ في الاتصال بالذكاء الاصطناعي. حاول مرة أخرى.";
    }
}

// الدالة الرئيسية للإجابة
async function askQuestion(question) {
    try {
        loadTrainingFiles();
        
        // البحث في الملفات المدربة
        const searchResults = searchInTraining(question);
        
        let context = "";
        if (searchResults.length > 0) {
            context = "المعلومات المتوفرة في قاعدة المعهد:\n\n";
            for (let i = 0; i < Math.min(searchResults.length, 3); i++) {
                context += `من ملف "${searchResults[i].fileName}":\n${searchResults[i].context}\n\n`;
            }
        }
        
        // استخدام DeepSeek للإجابة
        const answer = await askDeepSeek(question, context);
        
        return answer;
    } catch (error) {
        console.error('Error:', error);
        return "⚠️ حدث خطأ في معالجة السؤال. حاول مرة أخرى.";
    }
}

module.exports = { trainOnFile, clearAllData, askQuestion, loadTrainingFiles };
