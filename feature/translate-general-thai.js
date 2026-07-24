module.exports = async (message) => {
    // 1. Only run in the Thai translation channel
    if (message.channel.id !== '896754261680087080') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) return false;

        const prompt = `Translate the following text to Thai. It may contain internet slang or dialects. If it is ALREADY entirely in Thai, reply with exactly the word: ALREADY_THAI. 
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

        if (result && !result.includes('ALREADY_THAI')) {
            await message.reply({ 
                content: `-# **คำแปล:**\n${result}`, 
                allowedMentions: { repliedUser: false } 
            });
        }
        return true; 
    } catch (error) {
        console.error("❌ Gemini Thai Translate Error:", error);
        return false;
    }
};
