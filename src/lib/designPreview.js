export const PREVIEW_COOKIE = 'oae_design_preview';

export function isPreviewEnabled(user, preference) {
  return Boolean(user?.isActive && !user.mustChangePass && user.role === 'ADMIN' && preference === `ameba:${user.id}`);
}
