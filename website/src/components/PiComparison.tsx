import { codingTools, comparisonContent } from "../comparison";
import type { Locale } from "../content";

export function PiComparison({ locale }: { locale: Locale }) {
  const content = comparisonContent[locale];

  return (
    <main id="compare" className="comparison-page" aria-labelledby="comparison-page-title">
      <header className="comparison-intro">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1 id="comparison-page-title">{content.title}</h1>
        <p>{content.description}</p>
      </header>

      <section aria-labelledby="comparison-tools-title">
        <div className="comparison-heading">
          <h2 id="comparison-tools-title">{content.comparisonTitle}</h2>
          <p>{content.comparisonDescription}</p>
        </div>
        <div className="comparison-grid">
          {codingTools.map(({ id, name, url }) => {
            const tool = content.tools[id];
            return (
              <article className="comparison-card" data-tool={id} key={id}>
                <p className="eyebrow comparison-surface">{tool.surface}</p>
                <h3>{name}</h3>
                <p className="comparison-fit">{tool.fit}</p>
                <dl>
                  <dt>{content.strengths}</dt>
                  <dd>{tool.strengths}</dd>
                  <dt>{content.tradeoffs}</dt>
                  <dd>{tool.tradeoffs}</dd>
                </dl>
                <a href={url} aria-label={`${name} · ${content.docs}`}>
                  {content.docs} <span aria-hidden="true">↗</span>
                </a>
              </article>
            );
          })}
        </div>
      </section>

      <section className="comparison-workspace" aria-labelledby="comparison-workspace-title">
        <h2 id="comparison-workspace-title">{content.workspace.title}</h2>
        <p>{content.workspace.description}</p>
        <a href="#workflow">
          {content.workspace.link} <span aria-hidden="true">→</span>
        </a>
      </section>
    </main>
  );
}
