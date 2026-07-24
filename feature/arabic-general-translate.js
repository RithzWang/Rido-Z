module.exports = async (message) => {
    if (message.channel.id !== '880431177499029534') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_API_KEY) return false;

        const systemPrompt = `You are a highly accurate translator. Translate the user's message into natural Arabic. 
Translate all text, including laughter (e.g. "hahahaha" or "lol" -> "هههههههه"), interjections, internet slang, and non-Arabic script.
If the text is ALREADY written in Arabic script, reply with strictly the word: ALREADY_ARABIC
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

        if (result && !result.includes('ALREADY_ARABIC')) {
            await message.reply({ 
                content: `-# **ترجمة:**\n${result}\n-#   - الترجمة AI ليست دقيقة 100%`, 
                allowedMentions: { repliedUser: false } 
            });
        }
        return true; 
    } catch (error) {
        console.error("❌ OpenAI Arabic Translate Error:", error);
        return false;
    }
};
