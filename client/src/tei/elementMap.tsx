import type { TEIElementNode } from "../types/tei";
import type { FC, ReactNode } from "react";
import PassThrough from "./PassThrough";
import { Div, P, Head, L, Lg, Ab, Opener, Closer, Dateline, Salute, Signed, Trailer } from "./elements/structural";
import { Pb, Cb, Lb, Rubric, Supplied, Surplus, Gap, LacunaStart, LacunaEnd, Damage, Unclear, Del } from "./elements/digitizedText";
import { PersName, PlaceName, GeogName, OrgName, Rs, Name, AddName } from "./elements/names";
import { Hi, C } from "./elements/rendition";
import { Choice, Abbr, Expan, Ex, Sic, Corr, App, Lem, Rdg, Note, HandShift } from "./elements/transcription";

export interface TEIElementProps {
  node: TEIElementNode;
  children: ReactNode;
  anchorId: number;
  // Which editorial note this is, counted from 1 through the document (#154).
  // Only `note` is given one; every other element ignores it.
  noteNumber?: number;
  // Whether this element's next sibling element is a `cb` (#165). Only `pb`
  // reads it, to decide whether the column break already says what it would.
  // Siblings are not something a component can see, so the renderer's own
  // pre-pass works it out — the same seam `noteNumber` arrives through.
  followedByCb?: boolean;
}

export const elementMap: Record<string, FC<TEIElementProps>> = {
  // root wrappers
  TEI: PassThrough,
  teiCorpus: PassThrough,
  text: PassThrough,
  body: PassThrough,
  front: PassThrough,
  back: PassThrough,
  group: PassThrough,
  teiHeader: () => null,

  // structural
  div: Div,
  p: P,
  head: Head,
  l: L,
  lg: Lg,
  seg: PassThrough,
  ab: Ab,
  opener: Opener,
  closer: Closer,
  dateline: Dateline,
  salute: Salute,
  signed: Signed,
  trailer: Trailer,

  // digitized text (physical features)
  pb: Pb,
  cb: Cb,
  lb: Lb,
  rubric: Rubric,
  supplied: Supplied,
  surplus: Surplus,
  gap: Gap,
  lacunaStart: LacunaStart,
  lacunaEnd: LacunaEnd,
  damage: Damage,
  unclear: Unclear,
  del: Del,

  // names
  persName: PersName,
  placeName: PlaceName,
  geogName: GeogName,
  orgName: OrgName,
  rs: Rs,
  name: Name,
  addName: AddName,

  // rendition
  hi: Hi,
  c: C,

  // transcription & critical apparatus
  choice: Choice,
  abbr: Abbr,
  expan: Expan,
  ex: Ex,
  sic: Sic,
  corr: Corr,
  app: App,
  lem: Lem,
  rdg: Rdg,
  note: Note,
  handShift: HandShift,
};
