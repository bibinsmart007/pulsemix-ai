import os

with open("public/dj_live.html", "r", encoding="utf-8") as f:
    html = f.read()

# Add button
old_btn = '<button class="btn primary" id="startBtn" style="font-size:24px;padding:15px 40px;letter-spacing:2px;box-shadow:0 0 30px rgba(255,43,214,0.4);">START THE PARTY</button>'
new_btn = """<div style="display:flex; gap: 15px;">
    <button class="btn primary" id="startBtn" style="font-size:24px;padding:15px 40px;letter-spacing:2px;box-shadow:0 0 30px rgba(255,43,214,0.4);">RESUME PARTY</button>
    <button class="btn cyan" id="restartPartyBtn" style="font-size:20px;padding:15px 30px;letter-spacing:2px;">START OVER</button>
  </div>"""

html = html.replace(old_btn, new_btn)

# Add logic
old_logic = '$("startBtn").addEventListener("click", async () => {'
new_logic = """$("restartPartyBtn").addEventListener("click", () => {
    localStorage.removeItem("dj_live_save");
    $("startBtn").click();
  });

  $("startBtn").addEventListener("click", async () => {"""

html = html.replace(old_logic, new_logic)

with open("public/dj_live.html", "w", encoding="utf-8") as f:
    f.write(html)
