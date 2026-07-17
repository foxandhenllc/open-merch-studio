const sourceUrl = 'https://github.com/foxandhenllc/open-merch-studio';
const licenseUrl = `${sourceUrl}/blob/main/LICENSE`;

export function OpenSourceAttribution() {
  return (
    <p className="open-source-attribution">
      <span>Open Merch Studio is an open-source product by Fox &amp; Hen.</span>
      <a href={sourceUrl} target="_blank" rel="noreferrer">
        Source on GitHub
      </a>
      <span aria-hidden="true">·</span>
      <a href={licenseUrl} target="_blank" rel="noreferrer">
        MIT license
      </a>
    </p>
  );
}
