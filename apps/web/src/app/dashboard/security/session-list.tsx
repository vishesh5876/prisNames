'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SessionInfo } from '@prisnames/contracts';
import {
  Button, Skeleton, Badge, Alert,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@prisnames/ui';
import { Monitor, Smartphone, LogOut, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-provider';
import { toast } from 'sonner';

const SESSIONS_QUERY_KEY = ['auth', 'sessions'] as const;

function getDeviceIcon(userAgent: string | null) {
  if (!userAgent) return Monitor;
  if (/mobile|android|iphone/i.test(userAgent)) return Smartphone;
  return Monitor;
}

function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SessionList() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [revokeId, setRevokeId] = React.useState<string | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = React.useState(false);

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: () => apiFetch<{ sessions: SessionInfo[] }>('/auth/sessions').then((r) => r.sessions),
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => apiFetch(`/auth/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
      setRevokeId(null);
      toast.success('Session revoked');
    },
    onError: () => toast.error('Failed to revoke session'),
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => apiFetch('/auth/sessions', { method: 'DELETE' }),
    onSuccess: () => {
      setRevokeAllOpen(false);
      logout();
    },
    onError: () => toast.error('Failed to revoke sessions'),
  });

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-[var(--color-ink)]">Active Sessions</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRevokeAllOpen(true)}
          className="text-[var(--color-error-text)]"
        >
          <LogOut className="size-3.5" /> Revoke All
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )}

      {error && <Alert variant="error">Failed to load sessions</Alert>}

      {sessions && (
        <div className="divide-y divide-[var(--color-hairline)]">
          {sessions.map((session) => {
            const DeviceIcon = getDeviceIcon(session.userAgent);
            return (
              <div key={session.id} className="flex items-center gap-4 py-3">
                <div className="flex items-center justify-center size-9 rounded-[var(--radius-md)] bg-[var(--color-surface)] text-[var(--color-steel)] shrink-0">
                  <DeviceIcon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                      {session.ipAddress || 'Unknown IP'}
                    </p>
                    {session.isCurrent && <Badge variant="green-soft">Current</Badge>}
                  </div>
                  <p className="text-xs text-[var(--color-steel)] truncate">
                    Last active {formatRelativeTime(session.lastActiveAt)}
                  </p>
                </div>
                {!session.isCurrent && (
                  <button
                    onClick={() => setRevokeId(session.id)}
                    className="shrink-0 p-1.5 rounded-[var(--radius-sm)] text-[var(--color-steel)] hover:text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)] transition-colors"
                    aria-label="Revoke session"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Revoke single session confirm */}
      <Dialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Session</DialogTitle>
            <DialogDescription>This device will be logged out immediately.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              loading={revokeMutation.isPending}
              onClick={() => revokeId && revokeMutation.mutate(revokeId)}
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke all sessions confirm */}
      <Dialog open={revokeAllOpen} onOpenChange={setRevokeAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke All Sessions</DialogTitle>
            <DialogDescription>All sessions including this one will be logged out. You will need to sign in again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" loading={revokeAllMutation.isPending} onClick={() => revokeAllMutation.mutate()}>
              Revoke All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
