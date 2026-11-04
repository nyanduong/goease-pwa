import { useEffect, useId, useRef, useState } from 'react';
import { X } from '../icons';

const guides: Record<string, { purpose: string; steps: string[] }> = {
  'Tổng quan': {
    purpose:
      'Bắt đầu tại đây để biết kho địa điểm có gì và việc nào cần làm trước.',
    steps: [
      'Chọn khu vực: dùng ô tỉnh/thành ở thanh trên. Chọn Tất cả khu vực nếu muốn xem toàn bộ.',
      'Đọc số liệu: Tổng địa điểm là số mục trong kho; Bản nháp là dữ liệu chưa xuất bản; Đã xuất bản là dữ liệu đã được công khai.',
      'Mở danh sách: nhấn một ô số liệu để xem các địa điểm tương ứng. Chọn Cần xử lý để xem những mục còn thiếu thông tin.',
      'Xem trên bản đồ: mở Xem địa điểm trên bản đồ; dùng +/− để phóng to hoặc thu nhỏ, nhấn ghim để chọn địa điểm.',
      'Làm bước tiếp theo: chọn Thêm địa điểm để tự nhập, hoặc Xem việc cần kiểm tra để rà soát dữ liệu có sẵn. Bản nháp cần được kiểm tra trước khi xuất bản.',
    ],
  },
  'Địa điểm': {
    purpose:
      'Đây là danh sách địa điểm để tìm, chỉnh sửa và chuẩn bị nội dung cho khách xem.',
    steps: [
      'Thu gọn danh sách: chọn khu vực ở thanh trên, nhập tên hoặc địa chỉ vào ô tìm kiếm.',
      'Lọc trạng thái: chọn Tất cả, Bản nháp, Cần kiểm tra, Đã xuất bản hoặc Đã lưu trữ. Số cạnh mỗi nút là số mục của nhóm đó.',
      'Xem thông tin: nhấn tên địa điểm hoặc Chỉnh sửa. Có thể đổi giữa Danh sách và Bản đồ để tìm theo vị trí.',
      'Bổ sung dữ liệu: kiểm tra tên, địa chỉ, ảnh, giá, giờ mở cửa và nguồn. Cột Cần hoàn thiện cho biết thông tin đang thiếu.',
      'Lưu và kiểm tra: lưu bản nháp nếu còn đang làm; dùng xem trước để kiểm tra điều kiện trước khi xuất bản. Thêm địa điểm tạo một mục mới.',
    ],
  },
  'Cần kiểm tra': {
    purpose:
      'Xử lý các địa điểm còn thiếu thông tin, có thể trùng hoặc có dữ liệu nguồn thay đổi.',
    steps: [
      'Chọn phạm vi: chọn khu vực ở thanh trên rồi dùng ô tìm tên địa điểm.',
      'Chọn loại việc: dùng các nút Bản nháp, Có thể trùng, Nguồn thay đổi hoặc Giá cần kiểm tra để tìm đúng vấn đề.',
      'Mở địa điểm: chọn một dòng trong danh sách. Khung chi tiết cho biết thông tin hiện có và nội dung cần đối chiếu.',
      'Đối chiếu nguồn: xem ảnh, địa chỉ, giá và giờ mở cửa; mở nguồn tham khảo trước khi chấp nhận thông tin mới.',
      'Hoàn tất: dùng thao tác phù hợp trong chi tiết. Nếu thiếu căn cứ, giữ bản nháp và bổ sung thông tin thay vì xuất bản ngay.',
    ],
  },
  'Đợt thu thập': {
    purpose:
      'Một đợt thu thập là một lần hệ thống tìm và đưa dữ liệu địa điểm vào kho để kiểm tra.',
    steps: [
      'Xem các đợt đã có: tìm đợt theo khu vực và trạng thái; mở một đợt để xem chi tiết.',
      'Tạo đợt mới: chọn Tạo đợt thu thập, điền phạm vi và các thông tin được yêu cầu trong từng bước.',
      'Kiểm tra trước khi chạy: xem lại khu vực, nguồn và lựa chọn đã nhập ở bước xác nhận; chỉ bắt đầu khi đúng nhu cầu.',
      'Theo dõi kết quả: đọc trạng thái, tiến độ và số địa điểm mới hoặc cần đối chiếu; Làm mới cập nhật dữ liệu đang hiển thị.',
      'Sau khi hoàn tất: mở các địa điểm đã lấy về để kiểm tra. Thu thập thành công không có nghĩa mọi địa điểm đã được xuất bản.',
    ],
  },
  'Tiến trình lấy dữ liệu': {
    purpose:
      'Xem hệ thống đã tìm được giờ mở cửa và giá tham khảo cho từng địa điểm hay chưa.',
    steps: [
      'Tìm địa điểm: chọn khu vực ở thanh trên, nhập tên và lọc trạng thái để thu gọn bảng.',
      'Đọc tiến trình: trạng thái cho biết đang chờ, đang xử lý, có kết quả hoặc gặp lỗi. Số lượt thử không phải số kết quả hợp lệ.',
      'Xem kết quả: Giờ mở cửa và Giá tham khảo ghi Đã có gợi ý khi có dữ liệu; Chưa có nghĩa là chưa tìm được, không phải miễn phí hay mở cả ngày.',
      'Kiểm tra lỗi: mở Chi tiết ở dòng có thông báo để xem nguyên nhân hoặc thông tin lần thử trước.',
      'Rà soát nội dung: chọn Kiểm tra để mở địa điểm, đối chiếu nguồn rồi mới dùng gợi ý trong bản xuất bản.',
    ],
  },
  'Lịch sử & phê duyệt': {
    purpose:
      'Tra cứu những thay đổi đã diễn ra và xử lý các nội dung đang chờ duyệt.',
    steps: [
      'Chọn chế độ: Nhật ký hoạt động để xem việc đã xảy ra; Việc chờ duyệt để xem nội dung chưa xử lý xong.',
      'Tìm đúng mục: dùng ô tìm kiếm và các bộ lọc đang hiển thị. Đổi trang ở cuối danh sách để xem thêm.',
      'Đọc nhật ký: đối chiếu thời gian, người thực hiện, địa điểm và hoạt động; chọn dòng để xem chi tiết.',
      'Kiểm tra nội dung chờ duyệt: chọn địa điểm, so sánh thông tin và nguồn trước khi quyết định.',
      'Khi tải lỗi: chọn Thử tải lại. Không có dữ liệu do lỗi tải không có nghĩa là không có hoạt động.',
    ],
  },
  'Nguồn dữ liệu': {
    purpose:
      'Kiểm tra nơi cung cấp thông tin địa điểm và phát hiện những dữ liệu cần bổ sung.',
    steps: [
      'Mở Các nguồn: xem danh sách nguồn, trạng thái kết nối và lần hoạt động gần nhất.',
      'Đọc trạng thái: Chưa kết nối cần được cấu hình; Đã nhận dữ liệu thành công cho biết nguồn từng trả kết quả, không đảm bảo mọi thông tin đều chính xác.',
      'Xem chi tiết: chọn nguồn để đọc tình trạng, hạn mức hoặc lỗi. Dùng Làm mới để lấy lại trạng thái hiển thị.',
      'Mở Chất lượng địa điểm: xem các nhóm thiếu ảnh, giới thiệu, giá hoặc giờ mở cửa; chọn nhóm để mở danh sách cần xử lý.',
      'Bổ sung thông tin: mở địa điểm và đối chiếu nguồn. Nếu chưa kết nối được dịch vụ, nhờ người phụ trách cấu hình máy chủ kiểm tra; không đưa khóa API vào nội dung công khai.',
    ],
  },
  'Cài đặt': {
    purpose:
      'Quản lý tỉnh/thành khách được chọn và thời điểm cần nhắc kiểm tra dữ liệu.',
    steps: [
      'Tìm tỉnh/thành: trong Tỉnh/thành hiển thị, nhập tên hoặc chọn miền. Dùng Tất cả, Đang bật, Đang tắt để lọc danh sách.',
      'Bật hiển thị: nhấn công tắc ở dòng tỉnh/thành. Thao tác được lưu ngay và bắt đầu lấy địa điểm tham quan vào bản nháp; không cần nút lưu riêng.',
      'Tắt hiển thị: nhấn công tắc đang bật rồi đọc hộp xác nhận. Tỉnh/thành và địa điểm bên trong sẽ bị ẩn với khách; dữ liệu, chuyến đã lưu và lịch thu thập được giữ lại.',
      'Lấy và xem dữ liệu: Lấy địa điểm mở phần thu thập cho tỉnh/thành đó. Xem tiến trình mở các đợt thu thập của đúng tỉnh/thành.',
      'Đặt lời nhắc: chọn Nhắc kiểm tra dữ liệu, nhập số ngày từ 7 đến 365 rồi nhấn Lưu cài đặt. Lời nhắc không tự ẩn hay xuất bản địa điểm.',
      'Thiết lập nâng cao: chỉ đổi khi hiểu phạm vi ảnh hưởng ghi trong từng mục; kiểm tra lại lựa chọn trước khi lưu.',
    ],
  },
  'Tự động cập nhật': {
    purpose:
      'Đặt lịch để hệ thống lấy dữ liệu định kỳ mà không phải tạo từng đợt thủ công.',
    steps: [
      'Xem lịch hiện có: mở Lịch cập nhật, tìm khu vực và lọc lịch đang bật hoặc tạm dừng.',
      'Tạo lịch: chọn Tạo lịch hoặc Tạo lịch đầu tiên; chọn khu vực và thời gian trong biểu mẫu.',
      'Kiểm tra rồi lưu: xem lại các giá trị và thông tin thời gian trong biểu mẫu trước khi lưu lịch.',
      'Bật hoặc dừng: dùng công tắc ở dòng lịch. Tắt công tắc sẽ tạm dừng lịch; kiểm tra lần chạy tiếp theo ở cùng dòng.',
      'Xem kết quả: chọn Lần chạy để xem các lần đã thực hiện. Dữ liệu lấy về cần được kiểm tra trước khi xuất bản.',
    ],
  },
};
const editorGuide = {
  purpose:
    'Điền và kiểm tra thông tin để tạo một địa điểm khách có thể sử dụng.',
  steps: [
    'Thông tin cơ bản: nhập tên, địa chỉ, loại địa điểm và giới thiệu. Kiểm tra vị trí tham khảo trên bản đồ.',
    'Ảnh địa điểm: thêm hoặc chọn ảnh phù hợp, kiểm tra ảnh bìa và thông tin nguồn ảnh.',
    'Giá & giờ mở cửa: bổ sung giá và giờ đã đối chiếu. Chưa có thông tin không đồng nghĩa miễn phí hoặc mở cả ngày.',
    'Nguồn & lịch sử: kiểm tra căn cứ của nội dung và những thay đổi đã lưu trước đó.',
    'Lưu đề xuất: dùng khi muốn giữ phần đang làm. Bản nháp chưa xuất hiện với khách.',
    'Xem trước xuất bản: rà lại nội dung và các điều kiện còn thiếu; chỉ xác nhận xuất bản khi thông tin đã sẵn sàng.',
  ],
};

export function AdminPageHelp({
  title,
  description,
}: {
  title: string;
  description?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="admin-page-help"
        aria-label={`Hướng dẫn: ${title}`}
        title="Hướng dẫn sử dụng"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        ?
      </button>
      {open && (
        <HelpDialog
          title={title}
          description={description}
          onClose={() => {
            setOpen(false);
            requestAnimationFrame(() => trigger.current?.focus());
          }}
        />
      )}
    </>
  );
}
function HelpDialog({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string | undefined;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const guide =
    guides[title] ??
    (/^(Thêm|Chỉnh sửa) địa điểm/i.test(title)
      ? editorGuide
      : {
          ...guides['Địa điểm']!,
          purpose: description || guides['Địa điểm']!.purpose,
        });
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="admin-help-dialog"
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <small>HƯỚNG DẪN SỬ DỤNG</small>
          <h2 id={headingId}>{title}</h2>
        </div>
        <button
          type="button"
          className="admin-help-close"
          aria-label="Đóng hướng dẫn"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="admin-help-body">
        <p>{guide.purpose}</p>
        <h3>Cách sử dụng</h3>
        <ol>
          {guide.steps.map((step) => (
            <li key={step}>
              <strong>{step.slice(0, step.indexOf(':'))}:</strong>
              {step.slice(step.indexOf(':') + 1)}
            </li>
          ))}
        </ol>
      </div>
      <footer>
        <button type="button" onClick={onClose}>
          Đã hiểu
        </button>
      </footer>
    </dialog>
  );
}
