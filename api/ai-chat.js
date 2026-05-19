const fs = require('fs');
const path = require('path');
const { pipeline } = require('@xenova/transformers');

const VECTOR_DIR = path.join(__dirname, 'vector-store');

let embeddingModel = null;

async function getEmbeddingModel() {
    if (!embeddingModel) {
        embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embeddingModel;
}

// حساب التشابه بين متجهين (Cosine Similarity)
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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
            } catch (e) {}
        }
    }
    return allChunks;
}

// البحث عن الأجزاء الأكثر تشابهاً
async function searchSimilarChunks(questionEmbedding, chunks, limit = 5) {
    const scored = chunks.map(chunk => ({
        chunk: chunk,
        score: cosineSimilarity(questionEmbedding, chunk.embedding)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.chunk);
}

// توليد إجابة ذكية جداً من السياق
function generateSuperIntelligentAnswer(question, relevantChunks) {
    if (relevantChunks.length === 0) {
        return "⚠️ **عذراً، لم أجد معلومات كافية للإجابة على سؤالك**\n\n" +
               "📌 **نصيحة:** تأكد من تدريب الذكاء الاصطناعي على ملفات تحتوي على هذه المعلومات.\n" +
               "💡 يمكنك رفع ملفات PDF أو Word أو Excel تحتوي على معلومات عن المعهد.";
    }
    
    const questionLower = question.toLowerCase();
    let answer = '';
    
    // تحديد نوع السؤال وإضافة مقدمة مناسبة
    if (questionLower.includes('ما هو') || questionLower.includes('ماذا')) {
        answer = `📖 **تعريف ومعلومات:**\n\n`;
    } else if (questionLower.includes('كيف')) {
        answer = `🔧 **شرح الطريقة والخطوات:**\n\n`;
    } else if (questionLower.includes('لماذا')) {
        answer = `💡 **الأسباب والتحليل:**\n\n`;
    } else if (questionLower.includes('قارن') || questionLower.includes('الفرق')) {
        answer = `⚖️ **المقارنة والتحليل:**\n\n`;
    } else {
        answer = `📚 **إجابة على سؤالك:**\n\n`;
    }
    
    // تجميع المعلومات من الأجزاء المتشابهة
    const seen = new Set();
    const uniqueChunks = [];
    
    for (const chunk of relevantChunks) {
        const shortText = chunk.text.substring(0, 300);
        if (!seen.has(shortText)) {
            seen.add(shortText);
            uniqueChunks.push(chunk);
        }
    }
    
    for (let i = 0; i < uniqueChunks.length; i++) {
        const chunk = uniqueChunks[i];
        answer += `**${i + 1}.** ${chunk.text}\n\n`;
    }
    
    // إضافة المصادر
    const sources = [...new Set(uniqueChunks.map(c => c.source))];
    answer += `\n---\n📁 **المصادر:** ${sources.join(', ')}`;
    
    // إضافة نسبة الثقة
    const avgScore = relevantChunks.reduce((sum, c) => sum + (c.score || 0.5), 0) / relevantChunks.length;
    const confidence = Math.min(99, Math.max(50, Math.round(avgScore * 100)));
    
    let confidenceText = '';
    if (confidence >= 80) confidenceText = '🟢 **عالية جداً**';
    else if (confidence >= 60) confidenceText = '🟡 **متوسطة**';
    else confidenceText = '🟠 **منخفضة (قد تحتاج لمصادر إضافية)**';
    
    answer += `\n🎯 **نسبة الثقة:** ${confidence}% (${confidenceText})`;
    
    // إضافة نصيحة في حالة الثقة المنخفضة
    if (confidence < 60) {
        answer += `\n💡 **نصيحة:** قد تكون هناك معلومات أكثر دقة إذا قمت برفع ملفات إضافية عن هذا الموضوع.`;
    }
    
    return answer;
}

// الدالة الرئيسية للإجابة
async function askQuestion(question) {
    try {
        const allChunks = loadAllChunks();
        
        if (allChunks.length === 0) {
            return "🤖 **مرحباً! أنا المساعد الذكي للمعهد**\n\n" +
                   "⚠️ **لم يتم تدريبي بعد على أي معلومات.**\n\n" +
                   "📌 **لبدء استخدامي:**\n" +
                   "1. اذهب إلى صفحة إدارة الذكاء الاصطناعي\n" +
                   "2. ارفع ملفات (PDF، Word، Excel) تحتوي على معلومات عن المعهد\n" +
                   "3. سأتذكر كل المعلومات وأصبح قادراً على الإجابة على أسئلتك\n\n" +
                   "💡 **أنواع الملفات المدعومة:** PDF, Word, Excel, TXT";
        }
        
        // حساب متجه السؤال
        const model = await getEmbeddingModel();
        const questionResult = await model(question, { pooling: 'mean', normalize: true });
        const questionEmbedding = Array.from(questionResult.data);
        
        // البحث عن الأجزاء المتشابهة
        const relevantChunks = await searchSimilarChunks(questionEmbedding, allChunks, 5);
        
        // توليد الإجابة الذكية
        const answer = generateSuperIntelligentAnswer(question, relevantChunks);
        
        return answer;
    } catch (error) {
        console.error('Error:', error);
        return `⚠️ **حدث خطأ تقني**\n\n` +
               `📌 **الخطأ:** ${error.message}\n\n` +
               `💡 **الحل:** حاول مرة أخرى أو تحقق من تشغيل السيرفر بشكل صحيح.`;
    }
}

module.exports = { askQuestion, loadAllChunks };
