/** A word's definition from public/definitions.json: part of speech, text, and its base form if inflected. */
export type Def = [pos: string, text: string, base?: string];
export type Definitions = Record<string, Def>;

/** One line: the word, its base form for inflections (went → go), part of speech, and definition. */
export function Definition({ word, def }: { word: string; def: Def }) {
  const [pos, text, base] = def;
  return (
    <>
      <strong className="def-word">{word.toLowerCase()}</strong>
      {base && <span className="def-base"> ({base})</span>} <span className="def-pos">{pos}</span> {text}
    </>
  );
}
