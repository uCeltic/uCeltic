/**
 * #163 — the corpus-wide name register, fetched once.
 *
 * It is a property of the corpus rather than of the workspace: the same entries
 * whichever columns are open. So the interesting behaviour is not what it holds
 * but how often it asks — the Tag Filter menu is re-derived on every column
 * change, and re-fetching with it would re-ask a question whose answer cannot
 * have moved.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNameRegistryStore } from "./nameRegistryStore";
import { listNameEntities } from "../api/tei";
import type { NameEntity } from "../types/tei";

vi.mock("../api/tei", () => ({ listNameEntities: vi.fn() }));
const mockedList = vi.mocked(listNameEntities);

const REGISTER: NameEntity[] = [
    { code: "F64", kind: "person", headword: "Find" },
];

beforeEach(() => {
    mockedList.mockReset();
    useNameRegistryStore.setState({ entities: [], requested: false });
});

describe("nameRegistryStore", () => {
    //Test: what was fetched is what the menu reads
    it("holds the register once it arrives", async () => {
        mockedList.mockResolvedValue(REGISTER);

        useNameRegistryStore.getState().load();
        await vi.waitFor(() =>
            expect(useNameRegistryStore.getState().entities).toEqual(REGISTER),
        );
    });

    //Test: every render of every reader calls load(); only one request goes out
    it("fetches once however many callers ask", async () => {
        mockedList.mockResolvedValue(REGISTER);

        useNameRegistryStore.getState().load();
        useNameRegistryStore.getState().load();
        await vi.waitFor(() =>
            expect(useNameRegistryStore.getState().entities).toEqual(REGISTER),
        );
        useNameRegistryStore.getState().load();

        expect(mockedList).toHaveBeenCalledTimes(1);
    });

    //Test: a failed load costs the Tag Filter and nothing else — the register
    //stays empty, which the menu already knows how to say
    it("leaves the register empty when the fetch fails", async () => {
        mockedList.mockRejectedValue(new Error("offline"));

        useNameRegistryStore.getState().load();
        await vi.waitFor(() =>
            expect(useNameRegistryStore.getState().requested).toBe(false),
        );

        expect(useNameRegistryStore.getState().entities).toEqual([]);
    });

    //Test: a failure is not a verdict on the session — the next reader who
    //opens the menu tries again
    it("lets a later caller retry after a failure", async () => {
        mockedList.mockRejectedValueOnce(new Error("offline"));
        mockedList.mockResolvedValueOnce(REGISTER);

        useNameRegistryStore.getState().load();
        await vi.waitFor(() =>
            expect(useNameRegistryStore.getState().requested).toBe(false),
        );
        useNameRegistryStore.getState().load();

        await vi.waitFor(() =>
            expect(useNameRegistryStore.getState().entities).toEqual(REGISTER),
        );
    });
});
