import { LoginForm } from "@/components/auth/login-form";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="w-full max-w-md space-y-8 px-6">
        {/* Logo & title */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-brand-red flex items-center justify-center">
              <span className="text-white font-bold text-xl">R</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-brand-black tracking-tight">
                Robotek FinOS
              </h1>
              <p className="text-sm text-brand-gray-mid">
                Finance &amp; Compliance OS
              </p>
            </div>
          </div>
          <p className="text-brand-gray-mid text-sm">
            Sign in to access your financial dashboard
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-brand-gray-mid">
          Robotek India — Authorised personnel only
        </p>
      </div>
    </div>
  );
}
