"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { deleteCsvProfile, saveCsvProfile } from "../actions";

type Profile = {
  id?: string;
  name: string;
  is_default: boolean;
  column_map: Record<string, string>;
  columns_order: string[];
};

type AvailableKey = { key: string; label: string };

type Props = {
  initialProfiles: Profile[];
  availableKeys: AvailableKey[];
};

export function ExportProfilesEditor({
  initialProfiles,
  availableKeys,
}: Props) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const addProfile = () => {
    const fresh: Profile = {
      name: `Profile ${profiles.length + 1}`,
      is_default: profiles.length === 0,
      column_map: {},
      columns_order: availableKeys.slice(0, 5).map((k) => k.key),
    };
    setProfiles([...profiles, fresh]);
    setEditingIdx(profiles.length);
  };

  const update = (idx: number, patch: Partial<Profile>) => {
    setProfiles((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  };

  return (
    <div className="space-y-4">
      {profiles.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            No profiles yet. Until you add one, exports use the default schema.
          </p>
          <Button onClick={addProfile} className="rounded-full">
            + Create profile
          </Button>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={addProfile} className="rounded-full h-10 px-5">
              + New profile
            </Button>
          </div>
          {profiles.map((profile, idx) => (
            <ProfileCard
              key={profile.id ?? `new-${idx}`}
              profile={profile}
              availableKeys={availableKeys}
              isEditing={editingIdx === idx}
              onToggleEdit={() =>
                setEditingIdx(editingIdx === idx ? null : idx)
              }
              onChange={(patch) => update(idx, patch)}
              onDelete={() => {
                if (!profile.id) {
                  setProfiles(profiles.filter((_, i) => i !== idx));
                  if (editingIdx === idx) setEditingIdx(null);
                } else if (
                  confirm(`Delete profile "${profile.name}"?`)
                ) {
                  deleteCsvProfile(profile.id).then((r) => {
                    if (!r.ok) {
                      toast.error(r.error.message);
                    } else {
                      setProfiles(profiles.filter((_, i) => i !== idx));
                      toast.success("Profile deleted");
                      router.refresh();
                    }
                  });
                }
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  availableKeys,
  isEditing,
  onToggleEdit,
  onChange,
  onDelete,
}: {
  profile: Profile;
  availableKeys: AvailableKey[];
  isEditing: boolean;
  onToggleEdit: () => void;
  onChange: (p: Partial<Profile>) => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const onSave = () => {
    startTransition(async () => {
      const result = await saveCsvProfile({
        id: profile.id,
        name: profile.name,
        is_default: profile.is_default,
        column_map: profile.column_map,
        columns_order: profile.columns_order,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Profile saved");
      onToggleEdit();
      router.refresh();
    });
  };

  const toggleKey = (key: string) => {
    const isIn = profile.columns_order.includes(key);
    onChange({
      columns_order: isIn
        ? profile.columns_order.filter((k) => k !== key)
        : [...profile.columns_order, key],
    });
  };

  const moveUp = (key: string) => {
    const i = profile.columns_order.indexOf(key);
    if (i <= 0) return;
    const next = [...profile.columns_order];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange({ columns_order: next });
  };

  const moveDown = (key: string) => {
    const i = profile.columns_order.indexOf(key);
    if (i < 0 || i >= profile.columns_order.length - 1) return;
    const next = [...profile.columns_order];
    [next[i + 1], next[i]] = [next[i], next[i + 1]];
    onChange({ columns_order: next });
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <Input
              value={profile.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="h-9 max-w-xs"
            />
          ) : (
            <span className="font-medium">{profile.name}</span>
          )}
          {profile.is_default && (
            <span className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary rounded-full px-2 py-0.5">
              default
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button size="sm" onClick={onSave}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={onToggleEdit}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <a
                href={`/api/export/csv?profile=${encodeURIComponent(profile.name)}`}
                className="text-xs underline text-muted-foreground hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                test export ↗
              </a>
              <Button size="sm" variant="outline" onClick={onToggleEdit}>
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={onDelete}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="px-5 py-4 space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.is_default}
              onChange={(e) => onChange({ is_default: e.target.checked })}
            />
            Use this profile by default
          </label>

          <div className="space-y-2">
            <Label>Columns + order (drag-free for now, use ↑↓ buttons)</Label>
            <div className="rounded-md border divide-y">
              {profile.columns_order.map((key, idx) => {
                const meta = availableKeys.find((a) => a.key === key);
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground tabular-nums w-6">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{key}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {meta?.label ?? "(custom key)"}
                      </div>
                    </div>
                    <Input
                      value={profile.column_map[key] ?? ""}
                      onChange={(e) =>
                        onChange({
                          column_map: {
                            ...profile.column_map,
                            [key]: e.target.value,
                          },
                        })
                      }
                      placeholder={`ERP column name (default: ${key})`}
                      className="h-8 max-w-[220px] text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => moveUp(key)}
                      className="text-muted-foreground hover:text-foreground text-xs px-1"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(key)}
                      className="text-muted-foreground hover:text-foreground text-xs px-1"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleKey(key)}
                      className="text-muted-foreground hover:text-destructive text-xs"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Add a column</Label>
            <div className="flex flex-wrap gap-2">
              {availableKeys
                .filter((k) => !profile.columns_order.includes(k.key))
                .map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => toggleKey(k.key)}
                    className={cn(
                      "text-xs rounded-full border px-3 py-1 hover:bg-muted",
                    )}
                  >
                    + {k.key}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
