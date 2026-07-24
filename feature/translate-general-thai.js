module.exports = async (message) => {
    if (message.channel.id !== '878582639215407134') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_API_KEY) return false;

        const systemPrompt = `You are a highly accurate translator. Translate the user's message into Thai. 
The text might contain internet slang or dialects. 
If the text is ALREADY entirely in Thai, reply with exactly the word: ALREADY_THAI
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

        if (result && !result.includes('ALREADY_THAI')) {
            await message.reply({ 
                content: `-# **คำแปล:**\n${result}\n-#   - คำแปลโดย AI ไม่ได้แม่นยำ 100%`, 
                allowedMentions: { repliedUser: false } 
            });
        }
        return true; 
    } catch (error) {
        console.error("❌ OpenAI Thai Translate Error:", error);
        return false;
    }
};
