with open("public/dj_live.html", "r", encoding="utf-8") as f:
    content = f.read()

if '<script src="/dj_live_patches.js"></script>' not in content:
    content = content.replace("</body>", '<script src="/dj_live_patches.js"></script>\n</body>')

with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Restored dj_live_patches.js tag.")
