// Arabic — SCAFFOLDING ONLY (not launch content). Mirrors en.ts shape so the RTL
// pipeline and translation workflow are provable today. Copy is placeholder and
// must be reviewed by a native localization pass before enabling Arabic at launch.
import type { Dictionary } from "./en";

const ar: Dictionary = {
  brand: "نوميك هيلثسبان أو إس",
  tagline: "نظام تشغيل ذكاء طول العمر للمؤسسات.",
  nav: {
    product: "المنتج",
    portals: "البوابات",
    evidence: "الأدلة",
    security: "الأمان",
    signIn: "تسجيل الدخول",
    launch: "تشغيل نوميك هيلثسبان",
  },
  public: {
    heroTitle: "حوّل أبحاث طول العمر العالمية إلى صحة قابلة للقياس للقوى العاملة.",
    heroBody:
      "يحوّل نوميك هيلثسبان الأبحاث والتجارب والتحديثات التنظيمية باستمرار إلى معلومات مدعومة بالمصادر وإجراءات صحية مخصّصة وبرامج محمية للخصوصية.",
    ctaPrimary: "تشغيل نوميك هيلثسبان",
    ctaSecondary: "استكشف العرض التجريبي",
  },
  portals: {
    member: { name: "بوابة العضو", desc: "جواز صحتك الخاص ونتائجك وخطط العمل الآمنة." },
    enterprise: { name: "بوابة المؤسسة", desc: "تحليلات إجمالية محمية للخصوصية — دون بيانات صحية معرّفة." },
    reviewer: { name: "المراجعة العلمية والسريرية", desc: "تقييم الأدلة والإبلاغ عن السحب واعتماد المحتوى الطبي." },
    admin: { name: "إدارة المنصة", desc: "المستأجرون والمستخدمون والنماذج والحوكمة لمشغّلي نوميك." },
  },
  auth: {
    signInTitle: "تسجيل الدخول إلى نوميك هيلثسبان",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    submit: "تسجيل الدخول",
    error: "بريد إلكتروني أو كلمة مرور غير صحيحة.",
  },
  common: {
    signOut: "تسجيل الخروج",
    overview: "نظرة عامة",
    loading: "جارٍ التحميل…",
    demoBanner: "بيئة تجريبية — بيانات اصطناعية فقط.",
  },
};

export default ar;
