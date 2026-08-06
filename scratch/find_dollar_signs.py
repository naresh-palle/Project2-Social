import re
import glob

jsx_files = glob.glob("frontend/src/**/*.jsx", recursive=True)

for path in jsx_files:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, line in enumerate(lines, 1):
        # find $ that is not followed by { (template literal)
        matches = re.findall(r'(?<!\\)\$(?!\{)', line)
        if matches:
            print(f"{path}:{idx} -> {line.strip()}")
