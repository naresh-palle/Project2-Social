import os
import re

directory = r'frontend\src\pages'
pattern = re.compile(r'<Link\s+to="[^"]*"\s+className="[^"]*">\s*<ChevronLeft\s+className="[^"]*"\s*/>\s*Back\s*</Link>', re.DOTALL)

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.jsx'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = pattern.sub('', content)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Removed Back button from {file}")
