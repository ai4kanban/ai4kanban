// 仅运行自包含页面，iframe 使用不透明来源。
export function hyperframeDocument(html: string): string {
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data: blob:; base-uri 'none'; form-action 'none'">`;
  // 策略必须先于页面的所有资源。
  return policy + html;
}
