import s from "fast-safe-stringify";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stringify(o: any): string {
  return s(o, undefined, 2);
}

export function stripEmojis(text: string): string {
  const emojiRegex =
    /(?:[\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]|\ud83d[\udc00-\ude4f\ude80-\udeff]|\ud83e[\udd10-\udd3f\udd40-\uddff])/g;
  return text.replace(emojiRegex, "");
}
