import glob

files = glob.glob("frontend/src/**/*.jsx", recursive=True) + glob.glob("frontend/src/**/*.js", recursive=True)

for path in files:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, line in enumerate(lines, 1):
        if "USD" in line or "usd" in line or "dollar" in line.lower():
            print(f"{path}:{idx} -> {line.strip().encode('ascii', 'ignore').decode()}")
