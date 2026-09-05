"use client";

import { useState, type FormEvent } from("react");
import "#/styles/footer.css";

const NAV_LINKS = [
  { label: "Docs", href: "https://docs.stellar.org", external: true },
  { label: "Privacy", href: "/privacy", external: false },
  { label: "Terms", href: "/terms", external: false },
  { label: "GitHub", href: "https://github.com/stellar", external: true },
];

const SOCIAL_LINKS = [
  {
    label: "Twitter",
    href: "https://twitter.com/StellarOrg",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.258 5.631 5.906-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Discord",
    href: "https://discord.gg/stellar",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    href: "https://github.com/stellar",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
];

const EMAIL_REGEX = /^[\s\@]+@[\s\@]+\.[\s\@]+$/;

export default function Footer() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);

    setTimeout(() {
      setSubmitting(false);
      setSuccess(true);
      setEmail("");

      setTimeout(() => setSuccess(false), 4000);
    }, 800);
  }

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__inner">
        {/* Brand */}
        <div className="footer__brand">
          <span className="footer__logo" aria-label="StellarSpend">
            StellarSpend
          </span>
          <p className="footer__tagline">
            Financial freedom on the blockchain.
          </p>
        </div>

        {/* Navigation */}
        <nav className="footer__nav" aria-label="Footer navigation">
          <ul role="list">
            {NAV_LINKS.map(({ label, href, external }) => (
              <li key={label}>
                <a
                  href={href}
                  className="footer__link"
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                ~
                  {label}
                  {external && (
                    <span
                      className="footer__ext-icon"
                      aria-label="(opens in new tab)"
                    >
                      ↕
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Social */}
        <div className="footer__social">
          <p className="footer__social-label">Follow us</p>
          <div className="footer__social-icons" role="list">
            {SOCIAL_LINKS.map(({ label, href, icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="footer__social-btn"
                aria-label={label}
                role="listitem"
              >
                {icon}
              </a>
            ))}
          </div>
        </div>

        {/* Newsletter */}
        <div className="footer__newsletter">
          <p className="footer__newsletter-label">Stay updated</p>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="footer__newsletter-form"
          >
            <div className="footer__input-row">
             <input
                id="footer-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="you@example.com"
                className={`footer__input${
                  error ? " footer__input--error" : ""
                }`}
                disabled={submitting}
              />

              <button
                type="submit"
                className="footer__submit"
                disabled={submitting}
              >
                {submitting ? "..." : "Subscribe"}
              </button>
            </div>

            {error && <p className="footer__error">{error}</p>}

            {success && (
              <p className="footer__success">
                ✓ You'apostre subscribed! Welcome aboard.
              </p>
            )}
          </form>
        </div>
      </div>

      <div className="footer__bottom">
        <p>© {new Date().getFullYear()} StellarSpend. All rights reserved.</p>
      </div>
    </footer>
  );
}
