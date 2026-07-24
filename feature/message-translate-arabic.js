module.exports = async (message) => {
    // 1. Only run in the Arabic translation channel
    if (message.channel.id !== '880431177499029534') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        
        // 2. Auto-detect and translate to Arabic (tl=ar)
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        const detectedLang = data[2]; 
        let finalTranslation = "";

        // Only translate if the detected language is NOT already Arabic
        if (!detectedLang.startsWith('ar')) {
            finalTranslation = data[0].map(item => item[0]).join('');
        }

        // 3. Reply if there is a translation
        if (finalTranslation && finalTranslation.toLowerCase() !== text.toLowerCase()) {
            await message.reply({
                content: `-# **ترجمة:**\n${finalTranslation}`,
                allowedMentions: { repliedUser: false } 
            });
        }
        
        return true; 
    } catch (error) {
        console.error("❌ Arabic Translate Error:", error);
        return false;
    }
};
