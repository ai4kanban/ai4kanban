// Only self-contained compositions run; their iframe has an opaque origin.
export function hyperframeDocument(html: string): string {
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; base-uri 'none'; form-action 'none'">`;
  // Prepend before any authored markup so an earlier resource cannot escape the policy.
  return policy + html;
}
