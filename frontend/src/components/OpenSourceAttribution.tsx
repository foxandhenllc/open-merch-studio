import { merchantConfig } from '../generated/merchant-config';

const { attribution } = merchantConfig;
const licenseUrl = `${attribution.sourceUrl}/blob/main/LICENSE`;

export function OpenSourceAttribution() {
  return (
    <p className="open-source-attribution">
      <span>
        {attribution.projectName} is an open-source product by{' '}
        <a href={attribution.creatorUrl} target="_blank" rel="noreferrer">
          {attribution.creatorName}
        </a>
        .
      </span>
      <a href={attribution.sourceUrl} target="_blank" rel="noreferrer">
        Source on GitHub
      </a>
      <span aria-hidden="true">·</span>
      <a href={licenseUrl} target="_blank" rel="noreferrer">
        {attribution.licenseName} license
      </a>
    </p>
  );
}
