import os
import re

FRONTEND_DIR = r"C:\Users\ramna\Downloads\Project2-Social\frontend\src"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Replace border radius
    content = re.sub(r'\brounded-sm\b', 'rounded-3xl', content)
    content = re.sub(r'\brounded-md\b', 'rounded-3xl', content)
    content = re.sub(r'\brounded-lg\b', 'rounded-3xl', content)
    
    # Exceptions: if there are rounded corners on small tags, we might want rounded-full
    # But for a sweeping change, we replace them with rounded-3xl first. 
    # Actually, we can refine the sizes:
    content = re.sub(r'\btext-\[9px\]\b', 'text-xs', content)
    content = re.sub(r'\btext-\[10px\]\b', 'text-xs', content)
    content = re.sub(r'\btext-\[11px\]\b', 'text-xs', content)
    
    # Convert some text-xs to text-sm if they are purely paragraph/body text?
    # No, that's too aggressive and might break tight grids. Let's stick to upgrading micro-text to xs.
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk(FRONTEND_DIR):
    for file in files:
        if file.endswith('.jsx'):
            process_file(os.path.join(root, file))

print("Standardization complete.")
