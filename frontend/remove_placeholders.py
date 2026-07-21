import os
import re

frontend_dir = r"C:\Users\ramna\Downloads\Project3-Social\frontend\src"

def process_dir(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".jsx"):
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                # Remove placeholder="something" or placeholder={'something'}
                # Be careful not to remove placeholder props that are empty if they exist, or just remove all.
                # Regex to match placeholder="[^"]*" or placeholder={'[^']*'} or placeholder={""}
                # To be safe, just remove placeholder="[^"]*"
                new_content = re.sub(r'\s*placeholder="[^"]*"', '', content)
                new_content = re.sub(r"\s*placeholder='[^']*'", '', new_content)
                
                if new_content != content:
                    with open(path, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    print(f"Updated {file}")

process_dir(frontend_dir)
