from PIL import Image
import os

PUBLIC = "c:/Users/wangl/WorkBuddy/20260415180829/filmmarket/public"

files = [
    ("images/products/A_box_of_Kodak_Gold_200_color__2026-05-17T04-04-31.png", "images/products/p17-kodak-gold.webp"),
    ("images/products/A_vintage_Olympus_AF_1_point_a_2026-05-17T04-04-33.png", "images/products/p18-olympus-af1.webp"),
    ("images/products/A_Ricoh_RZ_730_CCD_digital_cam_2026-05-17T04-04-37.png", "images/products/p20-ricoh-rz730.webp"),
]

for src_path, dst_path in files:
    src = os.path.join(PUBLIC, src_path)
    dst = os.path.join(PUBLIC, dst_path)
    if not os.path.exists(src):
        print(f"  SKIP (not found): {src_path}")
        continue
    img = Image.open(src)
    img = img.convert("RGB")
    img.thumbnail((800, 800), Image.LANCZOS)
    img.save(dst, "WEBP", quality=80, method=6)
    orig_kb = os.path.getsize(src) / 1024
    new_kb = os.path.getsize(dst) / 1024
    pct = (1 - new_kb / orig_kb) * 100
    print(f"  {os.path.basename(src_path)}: {int(orig_kb)}KB -> {os.path.basename(dst_path)}: {int(new_kb)}KB ({int(pct)}% smaller)")
    os.remove(src)

print("")
print("Done!")
