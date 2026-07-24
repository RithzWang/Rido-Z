module.exports = async (message) => {
    if (message.channel.id !== '907979176236163133') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) return false;

        // Give the AI specific instructions on how to handle the two languages
        const prompt = `You are an expert translator. Analyze the following text. 
If it is in Arabic (including dialects like Khaleeji, Egyptian, etc.), translate it to English and prefix your response with "EN:".
If it is in English, translate it to Arabic and prefix your response with "AR:".
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
        
        // Safely extract the AI's response text
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        if (result.startsWith("EN:")) {
            await message.reply({ 
                content: `-# **Translation:**\n${result.substring(3).trim()}`, 
                allowedMentions: { repliedUser: false } 
            });
        } else if (result.startsWith("AR:")) {
            await message.reply({ 
                content: `-# **ترجمة:**\n${result.substring(3).trim()}`, 
                allowedMentions: { repliedUser: false } 
            });
        }
        return true; 
    } catch (error) {
        console.error("❌ Gemini Translate Error (Ar <-> En):", error);
        return false;
    }
};
