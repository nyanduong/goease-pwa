/* global window, document, navigator */
const installButton = document.querySelector('#install');
const status = document.querySelector('#status');
const guide = document.querySelector('#guide');
const instructions = document.querySelector('#instructions');
const standalone = window.matchMedia('(display-mode: standalone)');
let pendingPrompt = null;
let installed = standalone.matches || navigator.standalone === true;

function showInstalled() {
  installed = true;
  pendingPrompt = null;
  installButton.hidden = true;
  guide.hidden = true;
  status.textContent =
    'GoEase đã được cài đặt. Bạn có thể mở từ màn hình chính.';
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  if (installed) return;
  pendingPrompt = event;
  installButton.hidden = false;
  installButton.disabled = false;
  status.textContent =
    'Sẵn sàng cài đặt. Bấm nút phía trên rồi xác nhận với trình duyệt.';
});

window.addEventListener('appinstalled', showInstalled);
standalone.addEventListener('change', () => {
  if (standalone.matches) showInstalled();
});

installButton.addEventListener('click', async () => {
  if (!pendingPrompt || installed) return;
  const prompt = pendingPrompt;
  pendingPrompt = null;
  installButton.disabled = true;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (installed) return;
    status.textContent =
      choice.outcome === 'accepted'
        ? 'Đã gửi yêu cầu cài đặt. Hãy chờ trình duyệt hoàn tất.'
        : 'Bạn đã đóng hộp thoại. Bạn vẫn có thể cài GoEase từ menu trình duyệt.';
  } catch {
    if (!installed)
      status.textContent =
        'Chưa mở được hộp thoại. Hãy dùng menu trình duyệt theo hướng dẫn bên dưới.';
  } finally {
    installButton.hidden = installed || !pendingPrompt;
    installButton.disabled = false;
  }
});

if (installed) {
  showInstalled();
} else if (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
) {
  status.textContent = 'Trên iPhone/iPad, thêm GoEase từ menu chia sẻ.';
  instructions.textContent =
    'Mở trang này bằng Safari → bấm Chia sẻ → Thêm vào Màn hình chính → Thêm. Sau đó mở GoEase từ biểu tượng trên màn hình chính.';
} else {
  status.textContent =
    'Nút cài đặt sẽ hiện khi trình duyệt cho phép. Bạn cũng có thể dùng menu trình duyệt bên dưới.';
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  void navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .catch(() => {});
}
