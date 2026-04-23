import type { TEIDoc, TEICatalogEntry } from "../types/tei";

const BASE = "http://localhost:8000/api/tei/";

export async function listTEIDocs(): Promise<TEICatalogEntry[]> {
    const res = await fetch(`${BASE}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch TEI list: ${res.statusText}`);
    }
    return res.json();
}

export async function fetchTEIDoc(id: number): Promise<TEIDoc> {
    const res = await fetch(`${BASE}${id}/`);
    if (!res.ok) {
        throw new Error(`Failed to fetch TEI document: ${id}`);
    }
    return res.json();
}