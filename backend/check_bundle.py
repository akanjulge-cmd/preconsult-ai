import requests
import re

r = requests.get('https://frontend-hazel-six-6dsq834e13.vercel.app')
matches = re.findall(r'src="(/assets/[^"]+)"', r.text)
print('Script tags in HTML:', matches)
for m in matches:
    content = requests.get('https://frontend-hazel-six-6dsq834e13.vercel.app' + m).text
    print(m, 'Length:', len(content), 'Contains onrender.com:', 'preconsult-ai-backend.onrender.com' in content)
