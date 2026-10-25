export const catalogTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'Chưa có';
export const reviewGroups = {
  draft: 'Bản nháp cần xem',
  duplicate: 'Có thể trùng',
  source: 'Thông tin nguồn thay đổi / mâu thuẫn',
  price: 'Giá cần kiểm tra',
  quality: 'Chất lượng thông tin đang hiển thị',
};
