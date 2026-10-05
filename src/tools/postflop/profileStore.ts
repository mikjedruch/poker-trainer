import { useSyncExternalStore } from 'react';
import type { Profile } from '../../core/postflop/profiles';
import { BASELINE_ID, BUILT_IN_PROFILES, CUSTOM_PREFIX, copyProfile, sanitizeStoredProfiles, toStored } from '../../core/postflop/profiles';
import { readJson, writeJson } from '../../shared/storage';

// Custom opponent profiles and the active profile, kept in localStorage and shared by every
// postflop screen. Built-in profiles come from src/data/profiles.json and cannot be edited.

const PROFILES_KEY = 'poker-trainer/postflop-profiles/v1';
const ACTIVE_KEY = 'poker-trainer/postflop-active-profile/v1';

export type CustomProfile = Profile & { basedOn: string };

export interface ProfilesState {
  profiles: readonly Profile[];
  custom: readonly CustomProfile[];
  active: Profile;
}

function build(custom: CustomProfile[], activeId: unknown): ProfilesState {
  const profiles = [...BUILT_IN_PROFILES, ...custom];
  const active = profiles.find((p) => p.id === activeId) ?? profiles.find((p) => p.id === BASELINE_ID)!;
  return { profiles, custom, active };
}

let state = build(sanitizeStoredProfiles(readJson(PROFILES_KEY)), readJson(ACTIVE_KEY));
const listeners = new Set<() => void>();

function commit(custom: CustomProfile[], activeId: string): void {
  writeJson(
    PROFILES_KEY,
    custom.map((p) => toStored(p, p.basedOn)),
  );
  writeJson(ACTIVE_KEY, activeId);
  state = build(custom, activeId);
  listeners.forEach((l) => l());
}

export const profilesState = (): ProfilesState => state;

export function useProfiles(): ProfilesState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const findProfile = (id: string): Profile | undefined => state.profiles.find((p) => p.id === id);

export function setActiveProfile(id: string): void {
  if (findProfile(id)) commit([...state.custom], id);
}

/** Creates an editable copy of any profile and returns it. */
export function createCopy(source: Profile): CustomProfile {
  const id = `${CUSTOM_PREFIX}${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const copy: CustomProfile = { ...copyProfile(source, id, `${source.name} (kopia)`), basedOn: source.id };
  commit([...state.custom, copy], state.active.id);
  return copy;
}

export function saveCustomProfile(profile: CustomProfile): void {
  if (profile.builtIn) throw new Error('Built-in profiles cannot be edited');
  const exists = state.custom.some((p) => p.id === profile.id);
  const custom = exists ? state.custom.map((p) => (p.id === profile.id ? profile : p)) : [...state.custom, profile];
  commit(custom, state.active.id);
}

export function deleteCustomProfile(id: string): void {
  const custom = state.custom.filter((p) => p.id !== id);
  commit(custom, state.active.id === id ? BASELINE_ID : state.active.id);
}
