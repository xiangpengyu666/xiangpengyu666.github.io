import { useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import './ContactPage.css';

type Lang = 'cn' | 'en';

// Both resume languages live in /public. The English file is a placeholder —
// it currently points at the same PDF as Chinese until the English version
// is provided. Replace public/Xiangpeng-Yu-Resume-EN.pdf when ready (no other
// code change needed).
const RESUMES: Record<Lang, { url: string; downloadName: string; label: string }> = {
  cn: {
    url: `${import.meta.env.BASE_URL}Xiangpeng-Yu-Resume.pdf`,
    downloadName: 'Xiangpeng_Yu_CV_CN.pdf',
    label: '中文',
  },
  en: {
    // Placeholder — same file as CN until the EN version is uploaded
    url: `${import.meta.env.BASE_URL}Xiangpeng-Yu-Resume.pdf`,
    downloadName: 'Xiangpeng_Yu_CV_EN.pdf',
    label: 'English',
  },
};

const EMAIL = 'xiangpengyu020104@gmail.com';

// Hash params force the browser's PDF viewer to fit the page on load and
// hide the toolbar/sidebar so the user sees the whole resume without scrolling.
// (Works in Chrome / Edge / Firefox; Safari ignores #toolbar but respects #view.)
const previewUrl = (url: string) => `${url}#view=Fit&toolbar=0&navpanes=0&scrollbar=0`;

export default function ContactPage() {
  const [lang, setLang] = useState<Lang>('cn');
  const resume = RESUMES[lang];

  return (
    <div className="contact-page">
      <SiteHeader />

      <main className="contact-main">
        <h1>Get in touch</h1>
        <p className="contact-lede">
          Drop me a line, or grab my résumé below.
        </p>

        <ul className="contact-list">
          <li>
            <span className="contact-label">Email</span>
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </li>
          <li>
            <span className="contact-label">Résumé</span>
            <a
              href={resume.url}
              download={resume.downloadName}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download {resume.label} (PDF)
            </a>
          </li>
        </ul>

        {/* Language toggle for the inline preview */}
        <div className="contact-lang-toggle" role="tablist" aria-label="Resume language">
          {(Object.keys(RESUMES) as Lang[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={lang === k}
              className={`lang-tab ${lang === k ? 'is-active' : ''}`}
              onClick={() => setLang(k)}
            >
              {RESUMES[k].label}
            </button>
          ))}
        </div>

        {/* Inline preview — modern browsers render the PDF natively in an
            <object>; fallback link shows if the browser blocks it.
            Keying on lang forces the viewer to remount when the user switches,
            which is more reliable than swapping `data` in place. */}
        <object
          key={lang}
          className="contact-pdf"
          data={previewUrl(resume.url)}
          type="application/pdf"
          aria-label={`Résumé preview (${resume.label})`}
        >
          <a href={resume.url} target="_blank" rel="noopener noreferrer">
            Open résumé in a new tab
          </a>
        </object>
      </main>
    </div>
  );
}
