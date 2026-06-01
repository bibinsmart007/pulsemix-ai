import re

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    content = f.read()

# Fix wireKnob
old_wire = """function wireKnob(id, fn, fmt) {
    const el = $(id), val = $(id + "Val");
    if (!el) return;
    el.addEventListener("input", () => { const v = parseFloat(el.value); fn(v); val.textContent = fmt(v); });
  }"""

new_wire = """function wireKnob(id, fn, fmt) {
    const el = $(id), val = $(id + "Val");
    if (!el) return;
    el.addEventListener("input", () => { const v = parseFloat(el.value); fn(v); if(val) val.textContent = fmt(v); });
  }"""

content = content.replace(old_wire, new_wire)

with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed wireKnob.")
