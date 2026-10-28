// The Windows tray icon cannot carry text beside it, so the count is drawn onto it: a red disc
// in the corner with white digits, "9+" past nine.

use tauri::image::Image;

/// 3×5 digits, one row per byte, high bit on the left.
const DIGITS: [[u8; 5]; 10] = [
    [0b111, 0b101, 0b101, 0b101, 0b111],
    [0b010, 0b110, 0b010, 0b010, 0b111],
    [0b111, 0b001, 0b111, 0b100, 0b111],
    [0b111, 0b001, 0b111, 0b001, 0b111],
    [0b101, 0b101, 0b111, 0b001, 0b001],
    [0b111, 0b100, 0b111, 0b001, 0b111],
    [0b111, 0b100, 0b111, 0b101, 0b111],
    [0b111, 0b001, 0b010, 0b010, 0b010],
    [0b111, 0b101, 0b111, 0b101, 0b111],
    [0b111, 0b101, 0b111, 0b001, 0b111],
];
const PLUS: [u8; 5] = [0b000, 0b010, 0b111, 0b010, 0b000];
const RED: [u8; 4] = [0xdd, 0x4f, 0x1e, 0xff];
const WHITE: [u8; 4] = [0xff, 0xff, 0xff, 0xff];

pub fn draw(base: &Image<'_>, count: usize) -> Image<'static> {
    let (w, h) = (base.width() as i32, base.height() as i32);
    let mut px = base.rgba().to_vec();
    let mut put = |x: i32, y: i32, c: [u8; 4]| {
        if (0..w).contains(&x) && (0..h).contains(&y) {
            let i = ((y * w + x) * 4) as usize;
            px[i..i + 4].copy_from_slice(&c);
        }
    };

    let glyphs: Vec<[u8; 5]> = if count > 9 {
        vec![DIGITS[9], PLUS]
    } else {
        vec![DIGITS[count]]
    };
    let scale = (w / 16).max(1);
    let text_w = (glyphs.len() as i32 * 4 - 1) * scale;
    let radius = (text_w / 2 + 2 * scale).max(5 * scale);
    let (cx, cy) = (w - radius, h - radius);
    for y in cy - radius..=cy + radius {
        for x in cx - radius..=cx + radius {
            if (x - cx).pow(2) + (y - cy).pow(2) <= radius * radius {
                put(x, y, RED);
            }
        }
    }
    let (left, top) = (cx - text_w / 2, cy - 5 * scale / 2);
    for (g, rows) in glyphs.iter().enumerate() {
        for (row, bits) in rows.iter().enumerate() {
            for col in 0..3 {
                if bits & (0b100 >> col) != 0 {
                    for dy in 0..scale {
                        for dx in 0..scale {
                            put(
                                left + (g as i32 * 4 + col) * scale + dx,
                                top + row as i32 * scale + dy,
                                WHITE,
                            );
                        }
                    }
                }
            }
        }
    }
    Image::new_owned(px, w as u32, h as u32)
}
