module.exports = async (message) => {
    if (message.channel.id !== '880430039919906826') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_API_KEY) return false;

        const systemPrompt = `You are a highly accurate translator. Translate the user's message into natural Spanish. 
Translate all text, including interjections (e.g. "هاه" -> "¿Eh?"), laughter (e.g. "hahahaha" -> "jajajaja"), internet slang, and regional dialects.
If the text is ALREADY written natively in Spanish, reply with strictly the word: ALREADY_SPANISH
Do not add any extra explanations.`;

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

        if (result && !result.includes('ALREADY_SPANISH')) {
            await message.reply({ 
                content: `-# **Traducción:**\n${result}\n-#   - La traducción por IA no es 100% precisa`, 
                allowedMentions: { repliedUser: false } 
            });
        }
        return true; 
    } catch (error) {
        console.error("❌ OpenAI Spanish Translate Error:", error);
        return false;
    }
};
