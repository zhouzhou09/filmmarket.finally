from PIL import Image
import os

PUBLIC = "c:/Users/wangl/WorkBuddy/20260415180829/filmmarket/public"

products = [
    "images/products/p1-leica-m6.png",
    "images/products/p2-contax-t2.png",
    "images/products/p2-contax-t2-2.png",
    "images/products/p3-nikon-fm2.png",
    "images/products/p4-rolleiflex.png",
    "images/products/p5-kodak-portra.png",
    "images/products/p6-canon-ae1.png",
    "images/products/p7-olympus-mu2.png",
    "images/products/p8-fujifilm-velvia.png",
]

heros = [
    "images/hero1.png",
    "images/hero2.png",
    "images/hero3.png",
]

def optimize(src_path, max_w, max_h, quality):
    src = os.path.join(PUBLIC, src_path)
    name, _ = os.path.splitext(src_path)
    dst = os.path.join(PUBLIC, name + ".webp")
    if not os.path.exists(src):
        print("  SKIP (not found): " + src_path)
        return
    img = Image.open(src)
    img = img.convert("RGB")
    img.thumbnail((max_w, max_h), Image.LANCZOS)
    img.save(dst, "WEBP", quality=quality, method=6)
    orig_kb = os.path.getsize(src) / 1024
    new_kb = os.path.getsize(dst) / 1024
    pct = (1 - new_kb / orig_kb) * 100
    print("  " + os.path.basename(src_path) + "  " + str(int(orig_kb)) + "KB -> " + str(int(new_kb)) + "KB (" + str(int(pct)) + "% smaller)")

print("Optimizing product images...")
for p in products:
    optimize(p, 600, 400, 75)

print("")
print("Optimizing hero images...")
for h in heros:
    optimize(h, 1600, 900, 80)

print("")
print("Done!")
