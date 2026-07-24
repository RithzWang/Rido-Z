module.exports = async (message) => {
    if (message.channel.id !== '907979176236163133') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_API_KEY) return false;

        const systemPrompt = `You are an expert, natural-sounding translator. 
If the user's text is in Arabic (including any regional dialects or internet slang like Khaleeji, Egyptian, etc.), translate it to English and prefix your response with "EN:".
If the user's text is in English, translate it to Arabic and prefix your response with "AR:".
Only return the prefixed translation, nothing else.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ],
                temperature: 0.3
            })
        });

        const data = await response.json();
        const result = data.choices?.[0]?.message?.content?.trim() || "";

        if (result.startsWith("EN:")) {
            const finalTranslation = result.substring(3).trim();
            await message.reply({ 
                content: `-# **Translation:**\n${finalTranslation}\n-#   - AI translation is not 100% accurate`, 
                allowedMentions: { repliedUser: false } 
            });
        } else if (result.startsWith("AR:")) {
            const finalTranslation = result.substring(3).trim();
            await message.reply({ 
                content: `-# **ترجمة:**\n${finalTranslation}\n-#   - الترجمة AI ليست دقيقة 100%`, 
                allowedMentions: { repliedUser: false } 
            });
        }
        return true; 
    } catch (error) {
        console.error("❌ OpenAI Translate Error (Ar <-> En):", error);
        return false;
    }
};
