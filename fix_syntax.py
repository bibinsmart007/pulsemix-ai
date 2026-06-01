import re

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the syntax error in setTimeout
content = content.replace('setTimeout(() => if($("statMsg")) $("statMsg").textContent = "", 3000);', 'setTimeout(() => { if($("statMsg")) $("statMsg").textContent = ""; }, 3000);')
content = content.replace('setTimeout(() => if($("reqStatus")) $("reqStatus").textContent = "", 4000);', 'setTimeout(() => { if($("reqStatus")) $("reqStatus").textContent = ""; }, 4000);')

# Wait, the regex replaced ANY `$("...").textContent = ...` with `if($("...")) ...`
# Let's fix any occurrences of `() => if(` or `()=>if(`
content = re.sub(r'\(\)\s*=>\s*if\((.*?)\)\s*(.*?)\s*,', r'() => { if(\1) \2; },', content)


# Let's also create a robust safeText function at the top and replace ALL textContent assignments
safe_text_func = """function safeText(id, txt) {
  const el = $(id);
  if (el) el.textContent = txt;
}
"""

if "function safeText" not in content:
    content = content.replace("function $(id) { return document.getElementById(id); }", "function $(id) { return document.getElementById(id); }\n" + safe_text_func)

# And now replace all remaining `if($("id")) $("id").textContent = expr` with `safeText("id", expr)`
content = re.sub(r'if\(\$\([\'"]([^\'"]+)[\'"]\)\)\s*\$\([\'"][^\'"]+[\'"]\)\.textContent\s*=\s*([^;]+);', r'safeText("\1", \2);', content)

# Replace any lingering `$("id").textContent = expr;`
content = re.sub(r'\$\([\'"]([^\'"]+)[\'"]\)\.textContent\s*=\s*([^;]+);', r'safeText("\1", \2);', content)

with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed syntax errors.")
