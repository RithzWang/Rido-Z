module.exports = async (message) => {
    if (message.channel.id !== '880431177499029534') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) return false;

        const prompt = `Translate the following text to Arabic. It may contain internet slang. If it is ALREADY entirely in Arabic, reply with exactly the word: ALREADY_ARABIC. 
Text: "${text}"`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3 }
            })
        });

        const data = await response.json();
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        if (result && !result.includes('ALREADY_ARABIC')) {
            await message.reply({ 
                content: `-# **ترجمة:**\n${result}`, 
                allowedMentions: { repliedUser: false } 
            });
        }
        return true; 
    } catch (error) {
        console.error("❌ Gemini Arabic Translate Error:", error);
        return false;
    }
};
