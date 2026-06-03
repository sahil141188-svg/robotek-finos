/**
 * Public web-to-lead page. Shareable link / embeddable — captures enquiries
 * straight into Sales OS leads (source = Website), auto-assigned to NBD.
 * Lives outside /dashboard and is excluded from the auth proxy.
 */
import { IntakeForm } from "@/components/crm/intake-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Become a Robotek Partner — Enquiry",
  description: "Tell us about your business and our team will reach out.",
};

export default function IntakePage() {
  return (
    <main className="min-h-screen bg-brand-gray-light flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-brand-red">Robotek India</div>
          <p className="text-sm text-brand-gray-mid mt-1">Mobile Accessories Manufacturer · Est. 2004</p>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8">
          <h1 className="text-lg font-bold text-brand-black">Partner & Sales Enquiry</h1>
          <p className="text-sm text-brand-gray-mid mt-1 mb-5">
            Interested in stocking Robotek products or a bulk order? Share your details and our team will get in touch.
          </p>
          <IntakeForm />
        </div>
        <p className="text-center text-[11px] text-brand-gray-mid mt-4">© Robotek India</p>
      </div>
    </main>
  );
}
