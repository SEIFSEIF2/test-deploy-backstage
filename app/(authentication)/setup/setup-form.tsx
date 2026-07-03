'use client'

import { useActionState, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'

import { config } from '@/lib/config'
import { createWorkspace, type SetupState } from './actions'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function SetupForm() {
  const [state, formAction, pending] = useActionState<SetupState, FormData>(
    createWorkspace,
    undefined
  )
  const [showPassword, setShowPassword] = useState(false)

  return (
    <motion.div
      className="bg-card ring-foreground/10 relative w-full max-w-lg rounded-lg p-8 ring-1 md:p-10"
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 140, damping: 16 }}
    >
      <div className="mb-7 flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          {config.appName}
        </h1>
        <p className="text-muted-foreground text-base">
          Create your workspace and admin account.
        </p>
      </div>

      <form action={formAction}>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="workspace" className="text-sm">
              Workspace name
            </FieldLabel>
            <Input
              id="workspace"
              name="workspace"
              required
              placeholder="Acme Inc"
              className="h-9 px-3 text-sm md:text-sm"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="name" className="text-sm">
              Your name
            </FieldLabel>
            <Input
              id="name"
              name="name"
              required
              autoComplete="name"
              className="h-9 px-3 text-sm md:text-sm"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="email" className="text-sm">
              Email
            </FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-9 px-3 text-sm md:text-sm"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password" className="text-sm">
              Password
            </FieldLabel>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-9 px-3 pr-8 text-sm md:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={-1}
                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-1.5 flex items-center transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
          </Field>

          {state?.error && (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          )}

          <Field>
            <Button
              type="submit"
              disabled={pending}
              className="h-9 px-3 text-sm md:text-sm"
            >
              {pending ? 'Creating…' : 'Create workspace'}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </motion.div>
  )
}
