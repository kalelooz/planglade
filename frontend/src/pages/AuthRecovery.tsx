import { useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'
import { AuthFrame } from '@/components/AuthFrame'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const recoveryCodePattern = /^[0-9a-f]{4}(?:-[0-9a-f]{4}){7}$/i

export default function AuthRecovery() {
  const [email, setEmail] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    if (!recoveryCodePattern.test(recoveryCode.trim())) {
      setError('Enter one complete recovery code, including its hyphens.')
      return
    }
    if ([...newPassword].length < 15) {
      setError('Use a password with at least 15 characters.')
      return
    }
    if (newPassword !== confirmation) {
      setError('The new passwords do not match.')
      return
    }

    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/recovery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), recoveryCode: recoveryCode.trim(), newPassword }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { code?: unknown; message?: unknown } } | null
        const message = payload?.error?.code === 'RECOVERY_RATE_LIMITED'
          ? 'Too many recovery attempts. Wait 30 minutes and try again.'
          : payload?.error?.code === 'RECOVERY_NOT_AVAILABLE'
            ? 'Local account recovery is not enabled on this installation.'
            : 'The email or recovery code is incorrect, expired, or already used.'
        setError(message)
        return
      }
      setNewPassword('')
      setConfirmation('')
      setComplete(true)
    } catch {
      setError('Account recovery could not be completed. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthFrame compact>
      <div className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Local account recovery</p>
        <h1 className="pg-page-title mt-3">{complete ? 'Password changed' : 'Use a recovery code'}</h1>
        <p className="pg-body-muted mt-3">
          {complete
            ? 'Your previous sessions have been signed out. Continue with the new password.'
            : 'Enter the owner email and one code saved during first-time setup.'}
        </p>

        {complete ? (
          <div className="mt-8">
            <div role="status" className="flex items-start gap-3 rounded-lg border border-border bg-muted/55 p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">This recovery code has been consumed.</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Your other unused recovery codes remain available.</p>
              </div>
            </div>
            <Button asChild size="lg" className="mt-5 w-full"><Link to="/auth/login">Sign in with the new password</Link></Button>
          </div>
        ) : (
          <form className="mt-8" onSubmit={recover}>
            <FieldGroup className="gap-5">
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="recovery-email">Owner email</FieldLabel>
                <Input id="recovery-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" maxLength={320} required aria-invalid={Boolean(error)} className="h-11 bg-muted/45" />
              </Field>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="recovery-code">Recovery code</FieldLabel>
                <Input id="recovery-code" name="recovery-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} autoComplete="one-time-code" inputMode="text" spellCheck={false} maxLength={39} placeholder="0000-0000-0000-0000-0000-0000-0000-0000" required aria-invalid={Boolean(error)} className="h-11 bg-muted/45 font-mono text-xs sm:text-sm" />
                <FieldDescription>Each code works once. Hyphens are required.</FieldDescription>
              </Field>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="recovery-password">New password</FieldLabel>
                <Input id="recovery-password" name="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={15} maxLength={128} required aria-invalid={Boolean(error)} className="h-11 bg-muted/45" />
                <FieldDescription>Use 15–128 characters.</FieldDescription>
              </Field>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="recovery-confirmation">Confirm new password</FieldLabel>
                <Input id="recovery-confirmation" name="new-password-confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={15} maxLength={128} required aria-invalid={Boolean(error)} className="h-11 bg-muted/45" />
              </Field>
            </FieldGroup>

            <p id="recovery-error" role={error ? 'alert' : undefined} className={error ? 'mt-4 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive' : 'sr-only'}>{error}</p>
            <Button type="submit" size="lg" className="mt-5 w-full" disabled={pending} aria-describedby={error ? 'recovery-error' : undefined}>
              {pending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {pending ? 'Changing password…' : 'Change password'}
            </Button>
            <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>A successful reset invalidates existing sessions. PlanGlade never sends or displays saved recovery codes.</p>
            </div>
            <Button asChild variant="link" className="mt-3 h-auto px-0 text-xs"><Link to="/auth/login">Back to sign in</Link></Button>
          </form>
        )}
      </div>
    </AuthFrame>
  )
}
