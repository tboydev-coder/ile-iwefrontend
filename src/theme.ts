function rgb(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
export function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function mix(hex: string, target: number, amount: number) {
  return (
    '#' +
    rgb(hex)
      .map((v) =>
        Math.round(v + (target - v) * amount)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function brandTokens(color: string, dark: boolean) {
  const valid = /^#[0-9a-f]{6}$/i.test(color) ? color : '#156b55';
  const surface = dark ? '#192420' : '#ffffff';
  let link = valid;
  for (let i = 1; contrast(link, surface) < 4.5 && i <= 20; i++)
    link = mix(valid, dark ? 255 : 0, i / 20);
  return {
    primary: valid,
    onPrimary: contrast(valid, '#ffffff') >= 4.5 ? '#ffffff' : '#000000',
    link,
    soft: mix(valid, dark ? 20 : 255, dark ? 0.76 : 0.93),
  };
}
