module.exports = async (message) => {
    if (message.channel.id !== '878582639215407134') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_API_KEY) return false;

        const systemPrompt = `You are a highly accurate translator. Translate the user's message into English. 
The text might contain internet slang or regional dialects. 
If the text is ALREADY entirely in English, reply with exactly the word: ALREADY_ENGLISH
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

        if (result && !result.includes('ALREADY_ENGLISH')) {
            await message.reply({ 
                content: `-# **Translation:**\n${result}\n-#   - AI translation is not 100% accurate`, 
                allowedMentions: { repliedUser: false } 
            });
        }
        return true; 
    } catch (error) {
        console.error("❌ OpenAI General Translate Error (Any -> En):", error);
        return false;
    }
};
