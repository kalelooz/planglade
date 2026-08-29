import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, Mail, RefreshCw, Trash2, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  createWorkspaceInvite,
  getWorkspaceInvites,
  getWorkspaceMembers,
  getWorkspaceTeamEvents,
  removeWorkspaceMember,
  updateWorkspaceInvite,
  updateWorkspaceMemberRole,
  type WorkspaceInviteRole,
  type WorkspaceMember,
} from '@/lib/api/team'

type TeamSettingsProps = {
  workspaceId: string
  canManage: boolean
}

function initials(name: string | null, email: string) {
  const source = name?.trim() || email.split('@')[0] || '?'
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function roleLabel(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase()
}

export function TeamSettings({ workspaceId, canManage }: TeamSettingsProps) {
  const queryClient = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceInviteRole>('MEMBER')
  const [message, setMessage] = useState('')
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMember | null>(null)

  const members = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: ({ signal }) => getWorkspaceMembers(workspaceId, signal),
    retry: false,
  })
  const invites = useQuery({
    queryKey: ['workspace-invites', workspaceId],
    queryFn: ({ signal }) => getWorkspaceInvites(workspaceId, 'PENDING', signal),
    enabled: canManage,
    retry: false,
  })
  const events = useQuery({
    queryKey: ['workspace-team-events', workspaceId],
    queryFn: ({ signal }) => getWorkspaceTeamEvents(workspaceId, 8, signal),
    enabled: canManage,
    retry: false,
  })

  const refreshTeam = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['workspace-invites', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['workspace-team-events', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['session'] }),
    ])
  }

  const inviteMutation = useMutation({
    mutationFn: () => createWorkspaceInvite({
      workspaceId,
      email: email.trim(),
      role,
      ...(message.trim() ? { customMessage: message.trim() } : {}),
    }),
    onSuccess: async () => {
      toast.success(`Invitation sent to ${email.trim()}`)
      setEmail('')
      setMessage('')
      setRole('MEMBER')
      setInviteOpen(false)
      await refreshTeam()
    },
    onError: () => toast.error('Invitation could not be sent. Check the email delivery configuration and try again.'),
  })
  const roleMutation = useMutation({
    mutationFn: ({ userId, nextRole }: { userId: string; nextRole: WorkspaceInviteRole }) => updateWorkspaceMemberRole(workspaceId, userId, nextRole),
    onSuccess: async () => { toast.success('Member role updated'); await refreshTeam() },
    onError: () => toast.error('Member role could not be updated.'),
  })
  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeWorkspaceMember(workspaceId, userId),
    onSuccess: async () => { toast.success('Member removed'); setRemoveTarget(null); await refreshTeam() },
    onError: () => toast.error('Member could not be removed.'),
  })
  const inviteAction = useMutation({
    mutationFn: ({ inviteId, action }: { inviteId: string; action: 'revoke' | 'resend' }) => updateWorkspaceInvite(workspaceId, inviteId, action),
    onSuccess: async (_result, input) => { toast.success(input.action === 'revoke' ? 'Invitation revoked' : 'Invitation resent'); await refreshTeam() },
    onError: () => toast.error('Invitation could not be updated.'),
  })

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border/60 bg-card/35">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-3 py-3 sm:px-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><Users className="size-4 text-muted-foreground" /><p className="text-sm font-semibold">People with workspace access</p></div>
            <p className="mt-1 text-xs text-muted-foreground">{members.isLoading ? 'Loading members…' : members.isError ? 'Member count unavailable' : `${members.data?.length ?? 0} members · access is managed by this installation`}</p>
          </div>
          {canManage && <Button type="button" size="sm" className="h-11 sm:h-9" onClick={() => setInviteOpen(true)}><UserPlus className="size-4" /> Invite people</Button>}
        </div>

        {members.isLoading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground" role="status">Loading team…</p>
        ) : members.isError ? (
          <div className="flex items-center justify-between gap-3 px-4 py-5"><p className="text-sm text-destructive" role="alert">Team access could not be loaded.</p><Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => void members.refetch()}><RefreshCw className="size-3.5" /> Retry</Button></div>
        ) : (members.data?.length ?? 0) === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">No workspace members were returned.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {(members.data ?? []).map((member) => {
              const owner = member.role === 'OWNER'
              const pending = roleMutation.isPending || removeMutation.isPending
              return (
                <div key={member.userId} className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4">
                  <Avatar className="size-9 border border-border/60"><AvatarFallback className="text-xs font-semibold">{initials(member.user.name, member.user.email)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.user.name || member.user.email}</p><p className="truncate text-xs text-muted-foreground">{member.user.email}</p></div>
                  {owner || !canManage ? (
                    <Badge variant="outline" className="shrink-0 font-normal">{roleLabel(member.role)}</Badge>
                  ) : (
                    <Select value={member.role} onValueChange={(value) => roleMutation.mutate({ userId: member.userId, nextRole: value as WorkspaceInviteRole })} disabled={pending}>
                      <SelectTrigger aria-label={`Role for ${member.user.email}`} className="h-11 w-[112px] text-xs data-[size=default]:h-11 sm:h-8 sm:data-[size=default]:h-8"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="ADMIN">Admin</SelectItem><SelectItem value="MEMBER">Member</SelectItem><SelectItem value="VIEWER">Viewer</SelectItem></SelectContent>
                    </Select>
                  )}
                  {canManage && !owner && <Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground sm:size-9" onClick={() => setRemoveTarget(member)} disabled={pending} aria-label={`Remove ${member.user.email}`}><Trash2 className="size-4" /></Button>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {canManage && (
        <div className="mt-3 overflow-hidden rounded-lg border border-border/60">
          <div className="flex items-center gap-2 border-b border-border/60 bg-muted/25 px-4 py-2.5"><Mail className="size-4 text-muted-foreground" /><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pending invitations</p></div>
          {invites.isError && invites.data !== undefined && (
            <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3"><p className="text-xs text-muted-foreground" role="status">Invitations could not be refreshed. Showing the last loaded results.</p><Button variant="ghost" size="sm" className="h-11 sm:h-9" onClick={() => void invites.refetch()}><RefreshCw className="size-3.5" /> Retry</Button></div>
          )}
          {invites.isLoading ? (
            <p className="px-4 py-4 text-sm text-muted-foreground" role="status">Loading invitations…</p>
          ) : invites.isError && invites.data === undefined ? (
            <div className="flex items-center justify-between gap-3 px-4 py-4"><p className="text-sm text-destructive" role="alert">Pending invitations could not be loaded.</p><Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => void invites.refetch()}><RefreshCw className="size-3.5" /> Retry</Button></div>
          ) : (invites.data?.length ?? 0) === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {invites.data?.map((invite) => <div key={invite.id} className="flex min-w-0 flex-wrap items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{invite.email}</p><p className="text-xs text-muted-foreground">{roleLabel(invite.role)} · expires {new Date(invite.expiresAt).toLocaleDateString()}</p></div>
                <Button variant="ghost" size="sm" className="h-11 sm:h-9" disabled={inviteAction.isPending} onClick={() => inviteAction.mutate({ inviteId: invite.id, action: 'resend' })}>Resend</Button>
                <Button variant="ghost" size="sm" className="h-11 text-destructive hover:text-destructive sm:h-9" disabled={inviteAction.isPending} onClick={() => inviteAction.mutate({ inviteId: invite.id, action: 'revoke' })}>Revoke</Button>
              </div>)}
            </div>
          )}
        </div>
      )}

      {canManage && (
        <details className="mt-3 rounded-lg border border-border/60 px-4 py-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium sm:min-h-0 sm:py-0">Recent team activity</summary>
          {events.isError && events.data !== undefined && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2"><p className="text-xs text-muted-foreground" role="status">Activity could not be refreshed. Showing the last loaded results.</p><Button variant="ghost" size="sm" className="h-11 sm:h-9" onClick={() => void events.refetch()}><RefreshCw className="size-3.5" /> Retry</Button></div>
          )}
          {events.isLoading ? (
            <p className="mt-3 text-xs text-muted-foreground" role="status">Loading activity…</p>
          ) : events.isError && events.data === undefined ? (
            <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-destructive" role="alert">Recent activity could not be loaded.</p><Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => void events.refetch()}><RefreshCw className="size-3.5" /> Retry</Button></div>
          ) : (events.data?.length ?? 0) === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No recent team activity.</p>
          ) : (
            <ol className="mt-3 space-y-2 border-l border-border/60 pl-4">{events.data?.map((event) => <li key={event.id} className="text-xs leading-5 text-muted-foreground"><span className="text-foreground">{event.summary}</span><span className="ml-2 inline-flex items-center gap-1"><Clock3 className="size-3" />{new Date(event.createdAt).toLocaleString()}</span></li>)}</ol>
          )}
        </details>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite people</DialogTitle><DialogDescription>The invitation is tied to this email address. The recipient reviews the workspace and role before joining.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); inviteMutation.mutate() }}>
            <div><label htmlFor="team-invite-email" className="text-sm font-medium">Email address</label><Input id="team-invite-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-11" placeholder="person@company.com" /></div>
            <div><label htmlFor="team-invite-role" className="text-sm font-medium">Role</label><Select value={role} onValueChange={(value) => setRole(value as WorkspaceInviteRole)}><SelectTrigger id="team-invite-role" className="mt-1 h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ADMIN">Admin — manages people and workspace</SelectItem><SelectItem value="MEMBER">Member — creates and updates work</SelectItem><SelectItem value="VIEWER">Viewer — read-only access</SelectItem></SelectContent></Select></div>
            <div><label htmlFor="team-invite-message" className="text-sm font-medium">Message <span className="font-normal text-muted-foreground">optional</span></label><Textarea id="team-invite-message" value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1 min-h-24" maxLength={1200} placeholder="Add context for the invitation." /></div>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button><Button type="submit" disabled={inviteMutation.isPending || !email.trim()}>{inviteMutation.isPending ? 'Sending…' : 'Send invitation'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && !removeMutation.isPending && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove {removeTarget?.user.name || removeTarget?.user.email}?</AlertDialogTitle><AlertDialogDescription>{removeTarget?.user.email} will immediately lose access to this workspace. Their authored work remains.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={removeMutation.isPending}>Keep member</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" disabled={removeMutation.isPending} onClick={(event) => { event.preventDefault(); if (removeTarget) removeMutation.mutate(removeTarget.userId) }}>{removeMutation.isPending ? 'Removing…' : 'Remove member'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
