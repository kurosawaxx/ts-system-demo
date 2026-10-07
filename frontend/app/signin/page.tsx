import { LoginForm } from '@/features/auth/ui/LoginForm';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-gray-900">
          工数管理システム
        </h1>
        <LoginForm />
      </div>
    </div>
  );
}
