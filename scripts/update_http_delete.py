from pathlib import Path

path = Path(r"src/api/http.ts")
text = path.read_text()
if "export function httpDelete" not in text:
    text = text.strip() + "\nexport function httpDelete(path: string, options: RequestInit = {}) {\n  return request(path, { ...options, method: 'DELETE' });\n}\n"
    path.write_text(text + "\n")
