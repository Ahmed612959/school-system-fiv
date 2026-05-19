const fs = require('fs');
const path = require('path');
const { pipeline } = require('@xenova/transformers');

const VECTOR_DIR = path.join(__dirname, '../vector-store');

// تحميل النماذج (مرة واحدة فقط عند بدء التشغيل)
let embeddingModel = null;
let generationModel = null;

async function loadModels() {
    if (!embeddingModel) {
        console.log('🔄 جاري تحميل نماذج الذكاء الاصطناعي...');
        embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        generationModel = await pipeline('text-generation', 'Xenova/TinyLlama-1.1B-Chat-v1.0');
        console.log('✅ تم تحميل النماذج بنجاح');
    }
    return { embeddingModel, generationModel };
}

// حساب التشابه بين نصين (بحث بسيط)
function simpleSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
}

// البحث عن الأجزاء الأكثر تشابهاً مع السؤال
function searchSimilarChunks(question, chunks, limit = 5) {
    const scored = chunks.map(chunk => ({
        chunk: chunk,
        score: simpleSimilarity(question, chunk.text)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.chunk);
}

// تحميل جميع الأجزاء من جميع الملفات
function loadAllChunks() {
    let allChunks = [];
    const files = fs.readdirSync(VECTOR_DIR);
    
    for (const file of files) {
        if (file.endsWith('.json')) {
            const chunks = JSON.parse(fs.readFileSync(path.join(VECTOR_DIR, file), 'utf-8'));
            allChunks.push(...chunks);
        }
    }
    
    return allChunks;
}

// توليد إجابة بناءً على السياق
function generateResponse(question, relevantChunks) {
    const context = relevantChunks.map(c => c.text).join('\n\n');
    
    // بناء الإجابة من السياق المتاح
    let answer = `📚 بناءً على المعلومات المتوفرة في قاعدة المعهد:\n\n`;
    
    const relevantInfo = [];
    for (const chunk of relevantChunks) {
        if (chunk.text.toLowerCase().includes(question.toLowerCase())) {
            relevantInfo.push(chunk.text);
        }
    }
    
    if (relevantInfo.length > 0) {
        answer += relevantInfo.slice(0, 3).join('\n\n');
    } else {
        answer += relevantChunks.slice(0, 3).map(c => c.text).join('\n\n');
    }
    
    answer += `\n\n💡 المصدر: ${relevantChunks[0]?.source || 'قاعدة المعهد'}`;
    
    return answer;
}

// الدالة الرئيسية للإجابة على الأسئلة
async function askQuestion(question) {
    try {
        await loadModels();
        const allChunks = loadAllChunks();
        
        if (allChunks.length === 0) {
            return "⚠️ لم يتم تدريب الذكاء الاصطناعي على أي ملفات بعد. يرجى رفع ملفات أولاً من صفحة الإدارة.";
        }
        
        const relevantChunks = searchSimilarChunks(question, allChunks);
        const answer = generateResponse(question, relevantChunks);
        
        return answer;
    } catch (error) {
        console.error('Error in askQuestion:', error);
        return "⚠️ حدث خطأ في معالجة السؤال. حاول مرة أخرى.";
    }
}

module.exports = { askQuestion, loadAllChunks };
