const fs = require('fs');
const path = require('path');

const VECTOR_DIR = path.join(__dirname, '../vector-store');

// حساب التشابه البسيط
function simpleSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / (union.size || 1);
}

// البحث عن الأجزاء الأكثر تشابهاً
function searchSimilarChunks(question, chunks, limit = 3) {
    const scored = chunks.map(chunk => ({
        chunk: chunk,
        score: simpleSimilarity(question, chunk.text)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.chunk);
}

// تحميل جميع الأجزاء
function loadAllChunks() {
    let allChunks = [];
    
    if (!fs.existsSync(VECTOR_DIR)) return [];
    
    const files = fs.readdirSync(VECTOR_DIR);
    
    for (const file of files) {
        if (file.endsWith('.json')) {
            try {
                const chunks = JSON.parse(fs.readFileSync(path.join(VECTOR_DIR, file), 'utf-8'));
                allChunks.push(...chunks);
            } catch (e) {
                console.error('Error loading chunks from', file);
            }
        }
    }
    
    return allChunks;
}

// توليد إجابة
function generateResponse(question, relevantChunks) {
    if (relevantChunks.length === 0) {
        return "⚠️ عذراً، لم أجد معلومات كافية للإجابة على سؤالك. تأكد من تدريب الذكاء الاصطناعي على ملفات تحتوي على هذه المعلومات.";
    }
    
    let answer = `📚 بناءً على المعلومات المتوفرة:\n\n`;
    
    for (let i = 0; i < Math.min(relevantChunks.length, 3); i++) {
        answer += `${i + 1}. ${relevantChunks[i].text.substring(0, 300)}`;
        if (relevantChunks[i].text.length > 300) answer += '...';
        answer += `\n\n`;
    }
    
    answer += `💡 المصدر: ${relevantChunks[0]?.source || 'قاعدة المعهد'}`;
    
    return answer;
}

// الدالة الرئيسية للإجابة
async function askQuestion(question) {
    try {
        const allChunks = loadAllChunks();
        
        if (allChunks.length === 0) {
            return "⚠️ لم يتم تدريب الذكاء الاصطناعي على أي ملفات بعد. يرجى رفع ملفات (PDF أو TXT) من صفحة الإدارة أولاً.";
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
