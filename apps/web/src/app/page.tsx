import Header from "../components/landing/Header";
import Hero from "../components/landing/Hero";
import Features from "../components/landing/Features";
import LeadForm from "../components/landing/LeadForm";
import Faq from "../components/landing/Faq";
import Footer from "../components/landing/Footer";
import ProductSections from "../components/landing/ProductSections";
import PublicStatistics from "../components/landing/PublicStatistics";
import DynamicPublicContent from "../components/landing/DynamicPublicContent";
import AnalyticsConsent from "../components/landing/AnalyticsConsent";
import ActivityGallery from "../components/landing/ActivityGallery";
import Team from "../components/landing/Team";

export default function LandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Sunrise Academy",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: "id-ID",
    description: "Platform pembelajaran digital, praktik toko, dan affiliate multi-sekolah.",
  };
  return (
    <div className="public-site min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <a href="#main-content" className="sr-only z-[100] rounded-lg bg-white px-4 py-3 font-bold text-orange-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Lewati ke konten utama</a>
      <Header />
      <main id="main-content">
        <Hero />
        <ActivityGallery />
        <Features />
        <ProductSections />
        <Team />
        <PublicStatistics />
        <DynamicPublicContent />
        <LeadForm />
        <Faq />
      </main>
      <Footer />
      <AnalyticsConsent />
    </div>
  );
}
