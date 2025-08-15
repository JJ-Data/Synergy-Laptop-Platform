import { Helmet } from "react-helmet-async";

interface SeoProps {
  title: string;
  description?: string;
  canonical?: string;
}

export const Seo = ({ title, description, canonical }: SeoProps) => {
  const fullTitle = `${title}`;
  const desc =
    description ??
    "Synergy laptop financing platform for companies: approvals, repayments, and device management.";
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {desc && <meta name="description" content={desc} />}
      {canonical && <link rel="canonical" href={canonical} />}

      <meta property="og:title" content={fullTitle} />
      {desc && <meta property="og:description" content={desc} />}
      <meta property="og:type" content="website" />
    </Helmet>
  );
};

export default Seo;
