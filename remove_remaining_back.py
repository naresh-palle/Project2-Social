import os
import re

files_to_check = [
    r'frontend\src\pages\Invitations.jsx',
    r'frontend\src\pages\Wallet.jsx'
]

pattern = re.compile(r'<Link\s+to="/dashboard"[^>]*>.*?Back.*?</Link>', re.DOTALL)

for path in files_to_check:
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = pattern.sub('', content)
        
        if new_content != content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Removed Back button from {path}")
