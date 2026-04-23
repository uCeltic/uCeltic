import type { TEIElementNode } from "../types/tei";
import type { FC, ReactNode } from "react";
import PassThrough from "./PassThrough";

export interface TEIElementProps {
  node: TEIElementNode;
  children: ReactNode;
}

export const elementMap: Record<string, FC<TEIElementProps>> = {
  // Tier 1: passthrough with no styling — just render children
  TEI: PassThrough,
  teiCorpus: PassThrough,
  text: PassThrough,
  body: PassThrough,
  front: PassThrough,
  back: PassThrough,
  seg: PassThrough,
  teiHeader: () => null,
};