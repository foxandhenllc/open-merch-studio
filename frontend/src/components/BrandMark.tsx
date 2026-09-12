import { merchantConfig } from '../generated/merchant-config';
import './brand-mark.css';

export function BrandMark() {
  return (
    <img
      className="store-brand-mark"
      src={merchantConfig.brand.logoPath}
      alt=""
      width="40"
      height="40"
    />
  );
}
