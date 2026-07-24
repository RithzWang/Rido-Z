module.exports = async (message) => {
    // 1. Only run in the Spanish translation channel
    if (message.channel.id !== '880430039919906826') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        
        // 2. Auto-detect and translate to Spanish (tl=es)
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        const detectedLang = data[2]; 
        let finalTranslation = "";

        // Only translate if the detected language is NOT already Spanish
        if (!detectedLang.startsWith('es')) {
            finalTranslation = data[0].map(item => item[0]).join('');
        }

        // 3. Reply if there is a translation
        if (finalTranslation && finalTranslation.toLowerCase() !== text.toLowerCase()) {
            await message.reply({
                content: `-# **Traducción:**\n${finalTranslation}`,
                allowedMentions: { repliedUser: false } 
            });
        }
        
        return true; 
    } catch (error) {
        console.error("❌ Spanish Translate Error:", error);
        return false;
    }
};
