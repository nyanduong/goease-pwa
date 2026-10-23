export function SourceCredit({ expanded = false }: { expanded?: boolean }) {
  return (
    <details className="place-source-credit" open={expanded}>
      <summary>Bản quyền dữ liệu</summary>
      <small>
        Powered by{' '}
        <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">
          Geoapify
        </a>{' '}
        · ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors
        </a>{' '}
        ·{' '}
        <a
          href="https://opendatacommons.org/licenses/odbl/1-0/"
          target="_blank"
          rel="noreferrer"
        >
          ODbL
        </a>
      </small>
    </details>
  );
}
