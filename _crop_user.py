"""user.png — 좌/우 패널 각 3행x4열 = 12박스, 총 24박스.

테두리(검정 라운드 사각형) 외곽선까지가 박스의 경계. 외곽선 바깥은 잘라버린다.
"""
from __future__ import annotations
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw


def main():
    root = Path(__file__).parent
    src = root / "images" / "user.png"
    out_dir = root / "images" / "USER"
    out_dir.mkdir(parents=True, exist_ok=True)
    # 기존 결과 정리 (debug 포함)
    for old in out_dir.glob("*.png"):
        old.unlink()

    img = Image.open(src).convert("RGB")
    arr = np.array(img)
    H, W, _ = arr.shape
    print(f"size: {W}x{H}")

    r = arr[..., 0].astype(int)
    g = arr[..., 1].astype(int)
    b = arr[..., 2].astype(int)
    black = (r < 110) & (g < 110) & (b < 110)

    col_sum = black.sum(axis=0)
    row_sum = black.sum(axis=1)
    col_active = col_sum > max(3, H * 0.005)
    row_active = row_sum > max(3, W * 0.005)
    xs = np.where(col_active)[0]
    ys = np.where(row_active)[0]
    xmin, xmax = int(xs.min()), int(xs.max())
    ymin, ymax = int(ys.min()), int(ys.max())
    print(f"content bbox: ({xmin},{ymin}) - ({xmax},{ymax})")

    # 좌/우 패널 갭
    mid_lo = int(W * 0.40)
    mid_hi = int(W * 0.60)
    mid = col_sum[mid_lo:mid_hi]
    thresh = max(3, H * 0.003)
    low = mid < thresh
    best_start, best_len = 0, 0
    cur_start, cur_len = -1, 0
    for i, v in enumerate(low):
        if v:
            if cur_start == -1:
                cur_start = i
            cur_len += 1
        else:
            if cur_len > best_len:
                best_len = cur_len
                best_start = cur_start
            cur_start, cur_len = -1, 0
    if cur_len > best_len:
        best_len = cur_len
        best_start = cur_start
    gap_xmin = mid_lo + best_start
    gap_xmax = gap_xmin + best_len
    print(f"panel gap x: {gap_xmin} ~ {gap_xmax}")

    left_x0, left_x1 = xmin, gap_xmin
    right_x0, right_x1 = gap_xmax, xmax

    cols = 4
    rows = 3

    debug = img.copy()
    draw = ImageDraw.Draw(debug)

    def crop_panel(prefix: str, px0: int, px1: int) -> int:
        panel_black = black[:, px0:px1 + 1]
        panel_rows = panel_black.sum(axis=1) > max(3, (px1 - px0) * 0.005)
        ys_p = np.where(panel_rows)[0]
        if len(ys_p) == 0:
            print(f"  {prefix}: no rows")
            return 0
        py0, py1 = int(ys_p.min()), int(ys_p.max())
        cell_w = (px1 - px0 + 1) / cols
        cell_h = (py1 - py0 + 1) / rows
        print(f"  {prefix} panel: y {py0}~{py1}, cell {cell_w:.0f}x{cell_h:.0f}")
        n = 0
        for ri in range(rows):
            for ci in range(cols):
                cx0 = int(round(px0 + ci * cell_w))
                cy0 = int(round(py0 + ri * cell_h))
                cx1 = int(round(px0 + (ci + 1) * cell_w))
                cy1 = int(round(py0 + (ri + 1) * cell_h))
                sub = black[cy0:cy1, cx0:cx1]
                sh, sw = sub.shape
                if sh == 0 or sw == 0:
                    continue
                row_sums = sub.sum(axis=1)
                col_sums = sub.sum(axis=0)
                # 박스 라인 강도 임계 — 셀 폭의 50% 이상이 검정인 행 = 가로 라인
                line_h = int(sw * 0.50)
                line_v = int(sh * 0.25)
                box_rows = np.where(row_sums >= line_h)[0]
                box_cols = np.where(col_sums >= line_v)[0]
                if len(box_rows) < 2 or len(box_cols) < 2:
                    # fallback: 셀 위쪽 65% 영역에서 검정 픽셀 bbox
                    sub_top = sub[: int(sh * 0.65)]
                    if not sub_top.any():
                        print(f"    {prefix}_r{ri}c{ci}: empty cell, skip")
                        continue
                    ys2 = np.where(sub_top.any(axis=1))[0]
                    xs2 = np.where(sub_top.any(axis=0))[0]
                    y0 = cy0 + int(ys2.min()); y1 = cy0 + int(ys2.max()) + 1
                    x0 = cx0 + int(xs2.min()); x1 = cx0 + int(xs2.max()) + 1
                else:
                    y0 = cy0 + int(box_rows.min())
                    y1 = cy0 + int(box_rows.max()) + 1
                    x0 = cx0 + int(box_cols.min())
                    x1 = cx0 + int(box_cols.max()) + 1
                name = f"{prefix}_r{ri}_c{ci}"
                crop = img.crop((x0, y0, x1, y1))
                crop.save(out_dir / f"{name}.png")
                draw.rectangle([x0, y0, x1 - 1, y1 - 1], outline=(0, 200, 0), width=3)
                draw.text((x0 + 4, y0 + 2), name, fill=(0, 200, 0))
                n += 1
        return n

    n_left = crop_panel("M", left_x0, left_x1)
    n_right = crop_panel("F", right_x0, right_x1)
    debug.save(out_dir / "_debug_user.png")
    print(f"saved {n_left + n_right} boxes (M={n_left}, F={n_right})")


if __name__ == "__main__":
    main()
