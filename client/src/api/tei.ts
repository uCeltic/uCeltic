import type { TEIDoc, TEICatalogEntry, NameEntity } from "../types/tei";


const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

//get all the TEI documents from the database
export async function listTEIDocs(): Promise<TEICatalogEntry[]> {
    const res = await fetch(`${API_BASE}/tei/`);
    if (!res.ok) {
        throw new Error(`Failed to fetch TEI list: ${res.statusText}`);
    }
    return res.json();
}

//get a single TEI document from the database
export async function fetchTEIDoc(id: number): Promise<TEIDoc> {
    const res = await fetch(`${API_BASE}/tei/${id}/`);
    if (!res.ok) {
        throw new Error(`Failed to fetch TEI document: ${id}`);
    }
    return res.json();
}

// The corpus-wide name register the Tag Filter's menu is built from (#163).
// Whole and unnarrowed: it belongs to the corpus rather than to a request, and
// which of its entries are on offer depends on which columns are open — a
// question already answered on this side.
export async function listNameEntities(): Promise<NameEntity[]> {
    const res = await fetch(`${API_BASE}/tei/names/`);
    if (!res.ok) {
        throw new Error(`Failed to fetch the name register: ${res.statusText}`);
    }
    return res.json();
}