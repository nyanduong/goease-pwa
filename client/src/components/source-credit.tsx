export function SourceCredit({ expanded = false }: { expanded?: boolean }) {
  if (!expanded) return null;
  return (
    <section className="place-source-credit">
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
    </section>
  );
}
