import type { TEIElementNode } from "../types/tei";
import type { FC, ReactNode } from "react";
import PassThrough from "./PassThrough";
import { Div, P, Head, L, Lg, Ab, Opener, Closer, Dateline, Salute, Signed, Trailer } from "./elements/structural";
import { Pb, Lb, Rubric, Supplied, Surplus, Gap, LacunaStart, LacunaEnd, Damage, Unclear } from "./elements/digitizedText";
import { PersName, PlaceName, GeogName, OrgName, Rs, Name } from "./elements/names";
import { Choice, Abbr, Expan, Ex, Sic, Corr, App, Lem, Rdg, Note, HandShift } from "./elements/transcription";

export interface TEIElementProps {
  node: TEIElementNode;
  children: ReactNode;
  anchorId: number;
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
  lb: Lb,
  rubric: Rubric,
  supplied: Supplied,
  surplus: Surplus,
  gap: Gap,
  lacunaStart: LacunaStart,
  lacunaEnd: LacunaEnd,
  damage: Damage,
  unclear: Unclear,

  // names
  persName: PersName,
  placeName: PlaceName,
  geogName: GeogName,
  orgName: OrgName,
  rs: Rs,
  name: Name,

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
