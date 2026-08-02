// English — launch content. Keys are the contract; ar.ts mirrors this shape.
const en = {
  brand: "Numik HealthspanOS",
  tagline: "The longevity intelligence operating system for the enterprise.",
  nav: {
    product: "Product",
    portals: "Portals",
    evidence: "Evidence",
    security: "Security",
    signIn: "Sign in",
    launch: "Launch Numik HealthspanOS",
  },
  public: {
    heroTitle: "Turn global longevity research into measurable workforce healthspan.",
    heroBody:
      "Numik HealthspanOS continuously converts research, trials and regulatory updates into citation-backed intelligence, personalized wellness actions and privacy-protected workforce programs.",
    ctaPrimary: "Launch Numik HealthspanOS",
    ctaSecondary: "Explore the demo",
  },
  portals: {
    member: { name: "Member portal", desc: "Your private Healthspan Passport, scores and safe action plans." },
    enterprise: { name: "Enterprise portal", desc: "Privacy-protected aggregate workforce analytics — never identifiable PHI." },
    reviewer: { name: "Scientific & clinical review", desc: "Grade evidence, flag retractions, approve medical content." },
    admin: { name: "Platform administration", desc: "Tenants, users, models and governance for Numik operators." },
  },
  auth: {
    signInTitle: "Sign in to Numik HealthspanOS",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    error: "Invalid email or password.",
  },
  common: {
    signOut: "Sign out",
    overview: "Overview",
    loading: "Loading…",
    demoBanner: "Demo environment — synthetic data only.",
  },
};

// typeof en widens string literals to `string`, so other-locale dictionaries
// (ar.ts) can supply different copy while sharing the exact key shape.
export type Dictionary = typeof en;
export default en;
