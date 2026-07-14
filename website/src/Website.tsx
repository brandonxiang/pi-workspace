import { useEffect, useState } from "react";
import { InstallCommand } from "./components/InstallCommand";
import { ProductStage } from "./components/ProductStage";
import { siteContent, type Locale } from "./content";
import { persistLocale, readInitialLocale } from "./locale";

const githubUrl = "https://github.com/brandonxiang/my-pi";
const npmUrl = "https://www.npmjs.com/package/pi-workspace";

function PiMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      π
    </span>
  );
}

export function Website() {
  const [locale, setLocale] = useState<Locale>(readInitialLocale);
  const content = siteContent[locale];

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = content.meta.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", content.meta.description);
  }, [content.meta.description, content.meta.title, locale]);

  function selectLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    try {
      persistLocale(localStorage, nextLocale);
    } catch {
      // The locale still changes for this visit when storage is unavailable.
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="pi-workspace home">
          <PiMark />
          <span>pi-workspace</span>
        </a>
        <nav className="site-nav" aria-label="Primary navigation">
          <a href="#features">{content.navigation.features}</a>
          <a href="#workflow">{content.navigation.workflow}</a>
          <a href="#open-source">{content.navigation.openSource}</a>
        </nav>
        <div className="header-actions">
          <div className="language-control" aria-label={content.navigation.language}>
            <button
              type="button"
              data-locale="en"
              aria-pressed={locale === "en"}
              onClick={() => selectLocale("en")}
            >
              EN
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              data-locale="zh"
              aria-pressed={locale === "zh"}
              onClick={() => selectLocale("zh")}
            >
              中文
            </button>
          </div>
          <a className="github-link" href={githubUrl} target="_blank" rel="noreferrer">
            {content.navigation.github} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">
                <span aria-hidden="true">●</span> {content.hero.eyebrow}
              </p>
              <h1 id="hero-title">{content.hero.title}</h1>
              <p className="hero-description">{content.hero.description}</p>
              <InstallCommand
                command={content.install.command}
                copyLabel={content.install.copy}
                copiedLabel={content.install.copied}
                failedLabel={content.install.copyFailed}
              />
              <div className="hero-meta">
                <span>{content.hero.compatibility}</span>
                <a href={githubUrl} target="_blank" rel="noreferrer">
                  {content.hero.viewGithub} <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
            <ProductStage content={content.product} />
          </div>
        </section>

        <section className="capabilities-section" id="features" aria-labelledby="features-title">
          <div className="section-intro">
            <p className="eyebrow">{content.capabilitiesIntro.eyebrow}</p>
            <h2 id="features-title">{content.capabilitiesIntro.title}</h2>
            <p>{content.capabilitiesIntro.description}</p>
          </div>
          <div className="capability-list">
            {content.capabilities.map((capability) => (
              <article className="capability" data-capability={capability.key} key={capability.key}>
                <div
                  className={`capability-icon capability-icon-${capability.key}`}
                  aria-hidden="true"
                >
                  {capability.key === "sessions" ? "↳" : capability.key === "dialogue" ? "π" : ">_"}
                </div>
                <div>
                  <h3>{capability.title}</h3>
                  <p>{capability.description}</p>
                  <small>{capability.detail}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="workflow-section" id="workflow" aria-labelledby="workflow-title">
          <div className="section-intro workflow-intro">
            <p className="eyebrow">{content.workflow.eyebrow}</p>
            <h2 id="workflow-title">{content.workflow.title}</h2>
            <p>{content.workflow.description}</p>
          </div>
          <div className="workflow-path">
            <article>
              <span className="workflow-symbol" aria-hidden="true">
                ⌂
              </span>
              <h3>{content.workflow.sourceTitle}</h3>
              <p>{content.workflow.sourceDetail}</p>
            </article>
            <span className="workflow-connector" aria-hidden="true">
              →
            </span>
            <article className="workflow-focus">
              <PiMark />
              <h3>{content.workflow.bridgeTitle}</h3>
              <p>{content.workflow.bridgeDetail}</p>
            </article>
            <span className="workflow-connector" aria-hidden="true">
              →
            </span>
            <article>
              <span className="workflow-symbol" aria-hidden="true">
                ◎
              </span>
              <h3>{content.workflow.resultTitle}</h3>
              <p>{content.workflow.resultDetail}</p>
            </article>
          </div>
        </section>

        <section className="trust-section" id="open-source" aria-labelledby="trust-title">
          <div className="trust-heading">
            <p className="eyebrow">{content.trust.eyebrow}</p>
            <h2 id="trust-title">{content.trust.title}</h2>
            <p>{content.trust.description}</p>
          </div>
          <div className="trust-points">
            <article>
              <span aria-hidden="true">01</span>
              <h3>{content.trust.localTitle}</h3>
              <p>{content.trust.localDetail}</p>
            </article>
            <article>
              <span aria-hidden="true">02</span>
              <h3>{content.trust.credentialsTitle}</h3>
              <p>{content.trust.credentialsDetail}</p>
            </article>
            <article>
              <span aria-hidden="true">03</span>
              <h3>{content.trust.safeTitle}</h3>
              <p>{content.trust.safeDetail}</p>
            </article>
          </div>
        </section>

        <section className="install-section" aria-labelledby="install-title">
          <div>
            <p className="eyebrow">pi-workspace / npm</p>
            <h2 id="install-title">{content.install.title}</h2>
            <p>{content.install.description}</p>
          </div>
          <InstallCommand
            command={content.install.command}
            copyLabel={content.install.copy}
            copiedLabel={content.install.copied}
            failedLabel={content.install.copyFailed}
          />
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <a className="brand" href="#top">
            <PiMark />
            <span>pi-workspace</span>
          </a>
          <p>{content.footer.tagline}</p>
        </div>
        <div className="footer-links">
          <a href={githubUrl} target="_blank" rel="noreferrer">
            {content.footer.github} ↗
          </a>
          <a href={npmUrl} target="_blank" rel="noreferrer">
            {content.footer.npm} ↗
          </a>
        </div>
        <p className="attribution">{content.footer.attribution}</p>
      </footer>
    </div>
  );
}
