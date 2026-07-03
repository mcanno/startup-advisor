export function isSupervisor(userId: string): boolean {
  const ids =
    process.env.SUPERVISOR_USER_IDS?.split(",").map((s) => s.trim()) ?? [];
  return ids.length > 0 && ids.includes(userId);
}
