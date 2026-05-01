import type { TEIDoc } from "./tei";

export type DocumentId = string
export type DocumentFormat = 'txt'  | 'docx' | 'tei'

export type Document =
| { id: DocumentId; title: string; format: "txt" | "docx"; content: string }
| { id: DocumentId; title: string; format: "tei"; content: TEIDoc };