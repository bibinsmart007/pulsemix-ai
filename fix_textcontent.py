import re

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    content = f.read()

# Replace $("id").textContent = expression;
# with if($("id")) $("id").textContent = expression;
content = re.sub(r'\$\([\'"]([^\'"]+)[\'"]\)\.textContent\s*=\s*([^;]+);', r'if($("\1")) $("\1").textContent = \2;', content)

# Also fix toggleAutoMix and toggleFestivalFx which use t.children[1].textContent
content = content.replace('t.children[1].textContent="ON";', 'if(t.children[1]) t.children[1].textContent="ON";')
content = content.replace('t.children[1].textContent="OFF";', 'if(t.children[1]) t.children[1].textContent="OFF";')

# Also fix $(k.toLowerCase() + "RemainTxt").textContent = ...
content = re.sub(r'\$\(k\.toLowerCase\(\) \+ [\'"]RemainTxt[\'"]\)\.textContent\s*=\s*([^;]+);', r'const _rem = $(k.toLowerCase() + "RemainTxt"); if(_rem) _rem.textContent = \1;', content)

# Also fix $(k.toLowerCase() + "Time").textContent = ...
content = re.sub(r'\$\(k\.toLowerCase\(\) \+ [\'"]Time[\'"]\)\.textContent\s*=\s*([^;]+);', r'const _time = $(k.toLowerCase() + "Time"); if(_time) _time.textContent = \1;', content)

# Also fix $(deckLetter.toLowerCase() + "Title").textContent = ...
content = re.sub(r'\$\(deckLetter\.toLowerCase\(\) \+ [\'"]Title[\'"]\)\.textContent\s*=\s*([^;]+);', r'const _title = $(deckLetter.toLowerCase() + "Title"); if(_title) _title.textContent = \1;', content)


with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed textContent assignments.")
