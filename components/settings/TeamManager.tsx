"use client";

import { useState } from "react";
import { Copy, Loader2, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  TeamInvitationForUi,
  TeamMemberForUi,
} from "@/lib/team/loadTeam";
import type { AgencyRole } from "@/lib/types";

type Member = TeamMemberForUi;
type Invitation = TeamInvitationForUi;

type TeamResponse = {
  current_user_id: string;
  members: Member[];
  invitations: Invitation[];
  error?: string;
};

const ROLE_LABELS: Record<AgencyRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function invitationExpired(invitation: Invitation) {
  return new Date(invitation.expires_at).getTime() <= Date.now();
}

async function parsePayload(response: Response) {
  return (await response.json().catch(() => ({}))) as {
    error?: string;
    invite_url?: string;
  };
}

export function TeamManager({
  initialMembers,
  initialInvitations,
  currentUserId: initialCurrentUserId,
}: {
  initialMembers: Member[];
  initialInvitations: Invitation[];
  currentUserId: string;
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invitations, setInvitations] =
    useState<Invitation[]>(initialInvitations);
  const [currentUserId] = useState(initialCurrentUserId);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  async function loadTeam() {
    setLoading(true);
    const response = await fetch("/api/team");
    const payload = (await response.json()) as TeamResponse;

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to load team");
      setLoading(false);
      return;
    }

    setMembers(payload.members ?? []);
    setInvitations(payload.invitations ?? []);
    setLoading(false);
  }

  async function inviteTeamMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true);
    setInviteUrl(null);

    const response = await fetch("/api/team/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const payload = await parsePayload(response);

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to create invitation");
      setInviting(false);
      return;
    }

    setEmail("");
    setInviteUrl(payload.invite_url ?? null);
    toast.success("Invitation link created");
    await loadTeam();
    setInviting(false);
  }

  async function copyInviteLink(url: string | null) {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }

  async function refreshInvitation(invitation: Invitation) {
    setBusyId(invitation.id);
    const response = await fetch("/api/team/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: invitation.email,
        role: invitation.role,
      }),
    });
    const payload = await parsePayload(response);

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to refresh invitation");
      setBusyId(null);
      return;
    }

    setInviteUrl(payload.invite_url ?? null);
    toast.success("Invitation link refreshed");
    await loadTeam();
    setBusyId(null);
  }

  async function revokeInvitation(invitation: Invitation) {
    setBusyId(invitation.id);
    const response = await fetch("/api/team/invitations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: invitation.id }),
    });
    const payload = await parsePayload(response);

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to revoke invitation");
      setBusyId(null);
      return;
    }

    toast.success("Invitation revoked");
    await loadTeam();
    setBusyId(null);
  }

  async function updateMemberRole(member: Member, nextRole: AgencyRole) {
    if (member.role === nextRole) return;
    setBusyId(member.id);
    const response = await fetch("/api/team/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id, role: nextRole }),
    });
    const payload = await parsePayload(response);

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to update role");
      setBusyId(null);
      return;
    }

    toast.success("Role updated");
    await loadTeam();
    setBusyId(null);
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.email ?? "this member"} from the agency?`)) {
      return;
    }

    setBusyId(member.id);
    const response = await fetch("/api/team/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id }),
    });
    const payload = await parsePayload(response);

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to remove member");
      setBusyId(null);
      return;
    }

    toast.success("Member removed");
    await loadTeam();
    setBusyId(null);
  }

  return (
    <div className="space-y-8">
      <section className="surface-card p-6 md:p-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-xl tracking-tight">Invite a team member</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each login belongs to one agency. Agents shown on reports stay separate.
            </p>
          </div>
        </div>

        <form
          className="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem_auto]"
          onSubmit={inviteTeamMember}
        >
          <div className="space-y-2">
            <Label htmlFor="team-email">Email</Label>
            <Input
              id="team-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-role">Role</Label>
            <select
              id="team-role"
              value={role}
              onChange={(event) => setRole(event.target.value as "admin" | "member")}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" className="self-end" disabled={inviting}>
            {inviting ? (
              <>
                <Loader2 className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Invite
              </>
            )}
          </Button>
        </form>

        {inviteUrl ? (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {inviteUrl}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => copyInviteLink(inviteUrl)}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
        ) : null}
      </section>

      <section className="surface-card p-6 md:p-8">
        <div className="mb-6">
          <h2 className="font-display text-xl tracking-tight">Team members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Login access for this agency workspace.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading team...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isCurrentUser = member.user_id === currentUserId;
                const disabled = busyId === member.id;
                return (
                  <TableRow key={member.id}>
                    <TableCell className="whitespace-normal">
                      <div>
                        <p className="font-medium">{member.email ?? "Unknown email"}</p>
                        {isCurrentUser ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">You</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <select
                        value={member.role}
                        disabled={disabled}
                        onChange={(event) =>
                          updateMemberRole(member, event.target.value as AgencyRole)
                        }
                        className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    </TableCell>
                    <TableCell>{formatDate(member.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={disabled || isCurrentUser}
                        onClick={() => removeMember(member)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="surface-card p-6 md:p-8">
        <div className="mb-6">
          <h2 className="font-display text-xl tracking-tight">Pending invitations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Refresh an invitation to generate a new copyable link.
          </p>
        </div>

        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => {
                const expired = invitationExpired(invitation);
                const disabled = busyId === invitation.id;
                return (
                  <TableRow key={invitation.id}>
                    <TableCell className="whitespace-normal font-medium">
                      {invitation.email}
                    </TableCell>
                    <TableCell>{ROLE_LABELS[invitation.role]}</TableCell>
                    <TableCell>
                      <span className={expired ? "text-destructive" : undefined}>
                        {formatDate(invitation.expires_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={disabled}
                          onClick={() => refreshInvitation(invitation)}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Refresh
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={disabled}
                          onClick={() => revokeInvitation(invitation)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Revoke
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
