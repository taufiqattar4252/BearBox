"""
BearBox Asset Processor
1. Generates official Chrome Extension icons with the original navy rounded-square artwork.
2. Extracts a transparent, precisely antialiased cutout of the bear and open box mascot
   with no background, no square frame, and no halos for the floating website element.
"""

import os
from PIL import Image, ImageFilter
import numpy as np
from collections import deque

input_path = r"C:\Users\USER\.gemini\antigravity-ide\brain\6c80e9a5-76bf-4a5a-803e-6927beb9eb6b\.user_uploaded\media_1792168237116.png"

im = Image.open(input_path).convert("RGBA")
w, h = im.size
print(f"Loaded image: {w}x{h}")

# --- 1. GENERATE OFFICIAL CHROME EXTENSION ICONS (WITH ROUNDED SQUARE BACKGROUND) ---
os.makedirs("public/icons", exist_ok=True)
os.makedirs("dist/icons", exist_ok=True)

# Save master app icon
im.save("public/icons/bearbox-icon-master.png", "PNG")
im.save("dist/icons/bearbox-icon-master.png", "PNG")

icon_sizes = [16, 32, 48, 128]
for sz in icon_sizes:
    resized = im.resize((sz, sz), Image.Resampling.LANCZOS)
    resized.save(f"public/icons/icon-{sz}.png", "PNG")
    resized.save(f"dist/icons/icon-{sz}.png", "PNG")
    print(f"Saved icon-{sz}.png")

# --- 2. GENERATE PRECISE TRANSPARENT MASCOT CUTOUT ---
arr = np.array(im).astype(np.float32)

r = arr[:, :, 0]
g = arr[:, :, 1]
b = arr[:, :, 2]
a = arr[:, :, 3]

# In the navy background:
# R is 14-30, G is 18-35, B is 30-55, and B > R.
# In the mascot (bear and orange box):
# Red is warm and dominant: (R > B + 8) and (R > 35 or R > G).
# Even the darkest parts of the bear's eyes/nose have R=38-49, B=18-21 (R - B >= 20).
# Outside the rounded square: a == 0.

# Initial binary segmentation
is_mascot = (a > 30) & (r > b + 8) & ((r > 34) | (r > g + 4))

# Let's perform morphological hole closing to ensure all eye specular catchlights,
# pupil centers, and inner textures remain completely solid.
mask_img = Image.fromarray((is_mascot * 255).astype(np.uint8), mode="L")

# Apply slight dilation then erosion (closing) to seal any single-pixel boundaries
mask_closed = mask_img.filter(ImageFilter.MaxFilter(size=5)).filter(ImageFilter.MinFilter(size=5))
closed_arr = np.array(mask_closed) > 128

# Flood-fill from outer image border to identify true exterior background
exterior = np.zeros((h, w), dtype=bool)
queue = deque()

# Seed edges
for y in range(h):
    if not closed_arr[y, 0]:
        exterior[y, 0] = True
        queue.append((y, 0))
    if not closed_arr[y, w - 1]:
        exterior[y, w - 1] = True
        queue.append((y, w - 1))

for x in range(w):
    if not closed_arr[0, x] and not exterior[0, x]:
        exterior[0, x] = True
        queue.append((0, x))
    if not closed_arr[h - 1, x] and not exterior[h - 1, x]:
        exterior[h - 1, x] = True
        queue.append((h - 1, x))

while queue:
    cy, cx = queue.popleft()
    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        ny, nx = cy + dy, cx + dx
        if 0 <= ny < h and 0 <= nx < w:
            if not exterior[ny, nx] and not closed_arr[ny, nx]:
                exterior[ny, nx] = True
                queue.append((ny, nx))

# The mascot interior is everything not reached by exterior flood fill
mascot_solid = ~exterior

# Now create smooth, antialiased edge matte
# We compute a smooth alpha matte using a gentle Gaussian blur along the edge
solid_mask_img = Image.fromarray((mascot_solid * 255).astype(np.uint8), mode="L")

# Create edge feathering: 1.5px blur for smooth antialiased rendering on any website background
feathered = solid_mask_img.filter(ImageFilter.GaussianBlur(radius=1.2))
feathered_arr = np.array(feathered).astype(np.float32) / 255.0

# Prepare final RGBA image
out_arr = np.zeros((h, w, 4), dtype=np.uint8)

# Color defringing:
# On the transition pixels where alpha is between 0.05 and 0.95,
# the pixel color has blended with the navy background (~[20, 24, 40]).
# We remove the background color contribution to avoid any dark edge fringe.
bg_r, bg_g, bg_b = 21.0, 24.0, 42.0

final_alpha = np.clip(feathered_arr * 255.0, 0, 255).astype(np.uint8)

for c in range(3):
    channel = arr[:, :, c]
    bg_val = [bg_r, bg_g, bg_b][c]
    
    # De-bleed background from edge pixels
    alpha_norm = np.maximum(feathered_arr, 0.001)
    unmixed = (channel - bg_val * (1.0 - feathered_arr)) / alpha_norm
    unmixed = np.clip(unmixed, 0, 255)
    
    # Use unmixed color near edges, original color inside
    weight = np.clip((feathered_arr - 0.1) / 0.8, 0, 1)
    clean_channel = weight * channel + (1.0 - weight) * unmixed
    
    out_arr[:, :, c] = np.clip(clean_channel, 0, 255).astype(np.uint8)

out_arr[:, :, 3] = final_alpha

cutout_im = Image.fromarray(out_arr, mode="RGBA")

# Crop tightly around the mascot with a comfortable 8px safety padding
y_indices, x_indices = np.where(final_alpha > 10)
min_y, max_y = y_indices.min(), y_indices.max()
min_x, max_x = x_indices.min(), x_indices.max()

pad = 8
crop_box = (
    max(0, min_x - pad),
    max(0, min_y - pad),
    min(w, max_x + pad + 1),
    min(h, max_y + pad + 1)
)

cropped_mascot = cutout_im.crop(crop_box)
print(f"Cropped mascot dimensions: {cropped_mascot.size[0]}x{cropped_mascot.size[1]} px")

# Save high-res mascot cutout
cropped_mascot.save("public/icons/bearbox-mascot.png", "PNG")
cropped_mascot.save("dist/icons/bearbox-mascot.png", "PNG")

# Also create optimized web sizes (e.g. 120px height and 160px height for crisp rendering)
for target_h in [100, 140, 200]:
    aspect = cropped_mascot.size[0] / cropped_mascot.size[1]
    target_w = int(round(target_h * aspect))
    resized_m = cropped_mascot.resize((target_w, target_h), Image.Resampling.LANCZOS)
    resized_m.save(f"public/icons/bearbox-mascot-{target_h}.png", "PNG")
    resized_m.save(f"dist/icons/bearbox-mascot-{target_h}.png", "PNG")

print("All mascot assets successfully generated!")
