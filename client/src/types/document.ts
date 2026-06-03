import { defaultCoordinates } from "@dnd-kit/core";
import type { TEIDoc } from "./tei";


// define the document id and format
export type DocumentId = string
export type DocumentFormat = 'txt'  | 'docx' | 'tei'

export type Document =
| { id: DocumentId; title: string; format: "txt" | "docx"; content: string }
| { id: DocumentId; title: string; format: "tei"; content: TEIDoc };