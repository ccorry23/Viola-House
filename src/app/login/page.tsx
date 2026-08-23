import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'Sign in — Viola House',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <div className="mb-6 text-center">
        <span className="text-3xl" aria-hidden>
          📚
        </span>
        <p className="mt-1 font-display text-lg font-bold">Viola House</p>
      </div>
      <LoginForm next={next} />
    </main>
  )
}
