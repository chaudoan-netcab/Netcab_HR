// Mã banner đã ẩn (dùng chung server + client). Cookie "dash_hidden" = các mã ngắn nối bằng dấu chấm, giữ tối đa HIDDEN_MAX mã gần nhất.
export const HIDDEN_COOKIE = "dash_hidden";
export const HIDDEN_MAX = 40;

/** Mã ngắn (base36) từ chuỗi nội dung banner — djb2, đủ để phân biệt các nội dung khác nhau */
export function bannerKey(content: string): string {
  let h = 5381;
  for (let i = 0; i < content.length; i++) h = ((h << 5) + h + content.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
