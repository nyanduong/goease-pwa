import { Link } from 'react-router';
import { Surface } from '../shared/ui/surface';

export function SectionPage({ title }: { title: string }) {
  return (
    <Surface>
      <h1 className="section-title">{title}</h1>
      <p className="mt-2 text-ink-secondary">
        Mục này mới có điều hướng trong bản foundation.
      </p>
      <Link to="/" className="return-link mt-3">
        Về Khám phá
      </Link>
    </Surface>
  );
}

export function NotFoundPage() {
  return (
    <Surface>
      <h1 className="section-title">Không tìm thấy trang</h1>
      <Link to="/" className="return-link mt-3">
        Về Khám phá
      </Link>
    </Surface>
  );
}

export function RouteErrorPage() {
  return (
    <main className="shell-width py-6">
      <Surface>
        <h1 className="section-title">Không thể hiển thị trang</h1>
        <button
          className="action-button mt-4"
          onClick={() => window.location.reload()}
          type="button"
        >
          Tải lại trang
        </button>
      </Surface>
    </main>
  );
}
