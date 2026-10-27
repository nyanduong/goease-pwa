export const adminSections = [
  { key: 'overview', label: 'Tổng quan', keywords: 'dashboard thống kê' },
  { key: 'work', label: 'Cần kiểm tra', keywords: 'duyệt hàng chờ bản nháp' },
  { key: 'places', label: 'Địa điểm', keywords: 'danh mục bản đồ' },
  { key: 'automatic', label: 'Đợt thu thập', keywords: 'nhập đồng bộ' },
  {
    key: 'progress',
    label: 'Tiến trình lấy dữ liệu',
    keywords: 'tiến độ giá giờ mở cửa',
  },
  {
    key: 'history',
    label: 'Lịch sử & phê duyệt',
    keywords: 'nhật ký thao tác',
  },
  { key: 'sources', label: 'Nguồn dữ liệu', keywords: 'kết nối chất lượng' },
  { key: 'settings', label: 'Cài đặt', keywords: 'tỉnh thành hệ thống' },
  { key: 'rules', label: 'Tự động cập nhật', keywords: 'lịch chạy' },
] as const;
