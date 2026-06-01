import re

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    content = f.read()

# Remove anything after </html>
content = re.sub(r'</html>.*', '</html>', content, flags=re.DOTALL)

with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Cleanup complete.")
