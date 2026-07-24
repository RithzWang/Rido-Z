const fs = require('fs');
const path = require('path');

console.log("🧹 Starting cache cleanup...");

// 1. Target the feature folder
const featurePath = path.join(__dirname, 'feature');

if (fs.existsSync(featurePath)) {
    const files = fs.readdirSync(featurePath);
    let deletedCount = 0;

    files.forEach(file => {
        // 2. Find any old file that starts with "message-" (ignores your new "gmessage-" files)
        if (file.startsWith('message-') && file.endsWith('.js')) {
            const filePath = path.join(featurePath, file);
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted old ghost file: ${file}`);
            deletedCount++;
        }
    });

    if (deletedCount === 0) {
        console.log("✨ No old files found. The cache is already clean!");
    } else {
        console.log(`✅ Successfully wiped ${deletedCount} old files from the system.`);
    }
} else {
    console.log("❌ Could not find the 'feature' folder.");
}

console.log("🚀 Next step: push these deletions to GitHub so your host updates!");
