import type { TEIDoc } from "./tei";

export type ManuscriptId = string
export type ManuscriptFormat = 'txt'  | 'docx' | 'tei'

export type Manuscript =
| { id: ManuscriptId; title: string; format: "txt" | "docx"; content: string }
| { id: ManuscriptId; title: string; format: "tei"; content: TEIDoc };