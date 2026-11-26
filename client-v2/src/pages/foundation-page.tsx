import { HealthCheck } from '../features/system-health/health-check';

export function FoundationPage() {
  return (
    <>
      <section className="foundation-hero" aria-labelledby="foundation-title">
        <div className="hero-art">
          <img
            src="/brand/e2-river-night.svg"
            alt=""
            width="358"
            height="125"
          />
          <span>Minh họa tạm</span>
        </div>
        <div className="hero-copy">
          <p className="hero-region">Cần Thơ</p>
          <h1 id="foundation-title" className="hero-title">
            Nền tảng GoEase
          </h1>
          <p>
            Nền tảng khám phá, trải nghiệm và nhận quyền lợi khi du lịch miền
            Tây.
          </p>
        </div>
      </section>
      <HealthCheck />
    </>
  );
}
