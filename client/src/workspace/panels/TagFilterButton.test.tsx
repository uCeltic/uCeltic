/**
 * #163 — the Tag Filter, rebuilt on the corpus's own name grouping.
 *
 * The control offers the people and places the manuscripts name, grouped as the
 * corpus groups them: by the bare `@nymRef` id every occurrence carries. The
 * name a group goes by comes from the register, because no TEI file in this
 * corpus says what `F64` stands for (#162) — but the grouping, the kinds and
 * the counts are all the corpus's own.
 *
 * What the menu is *not* allowed to fall back to is the thing it was before the
 * `standOff` reader: a hard-coded list of TEI element names, which offered
 * options no document could match (#147). Every row here can match something in
 * a visible column, or it is not a row.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import TagFilterButton from "./TagFilterButton";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { useDocumentStore } from "../../store/documentStore";
import { useNameRegistryStore } from "../../store/nameRegistryStore";
import type { Document } from "../../types/document";
import type {
    NameEntity,
    TEIDoc,
    TEINameIndex,
    TEINode,
    TEIWork,
} from "../../types/tei";

function index(counts: Record<string, number>): TEINameIndex {
    return Object.fromEntries(
        Object.entries(counts).map(([code, count]) => [
            code,
            { count, types: {}, variants: {}, anchors: [] },
        ]),
    );
}

function teiDoc(
    id: string,
    nameIndex: TEINameIndex,
    work: TEIWork | null = null,
): Document {
    return {
        id,
        title: id,
        format: "tei",
        content: {
            id: 1,
            title: id,
            language: "ga",
            work,
            created_at: "",
            meta: { title: id, author: "", language: "ga", pbCount: 0 },
            anchors: [],
            word_array: [],
            name_index: nameIndex,
            parsed_json: {
                tag: "TEI",
                children: [
                    { tag: "text", children: [{ tag: "body", children: [] as TEINode[] }] },
                ],
            },
        } as TEIDoc,
    };
}

// The register: what the corpus's group ids are called, which is the one thing
// the corpus itself does not carry.
const REGISTER: NameEntity[] = [
    { code: "F64", kind: "person", headword: "Find" },
    { code: "C6", kind: "person", headword: "Caílti" },
    { code: "e6", kind: "place", headword: "Érend" },
    { code: "P1", kind: "person", headword: "Pātraic" },
    // Lismore's typo: nymRef="64" once where it means F64.
    { code: "64", kind: "person", headword: "Ḟinn" },
    // Named by some other manuscript; no visible column here uses it.
    { code: "t8", kind: "place", headword: "Temair" },
];

const franA4 = teiDoc("franA4", index({ F64: 21, C6: 14, e6: 39 }));
const lis204 = teiDoc("lis204", index({ F64: 16, C6: 13, e6: 24, "64": 1 }));

function openDocs(...docs: Document[]) {
    useDocumentStore.setState({
        openDocuments: docs,
        visibleDocumentIds: docs.map((d) => d.id),
    });
}

beforeEach(() => {
    useWorkspaceStore.setState({
        selectedEntityId: null,
        entityIndexByDocument: {},
        selectedWorkId: null,
    });
    useNameRegistryStore.setState({ entities: REGISTER, load: () => {} });
    openDocs(franA4, lis204);
});

// the dropdown only exists once the trigger is clicked open
function open() {
    render(<TagFilterButton />);
    fireEvent.click(screen.getByRole("button", { name: /all tags/i }));
}

function rowLabels() {
    return screen
        .getAllByRole("menuitemradio")
        .map((row) => row.textContent ?? "");
}

describe("TagFilterButton", () => {
    //Test: one row per entity the open columns actually name
    it("offers the entities the visible columns name", () => {
        open();

        expect(rowLabels().length).toBe(4);
    });

    //Test: the headword AND the group id, because a researcher cross-checks
    //against their own name lists and the code is the only shared key
    it("prints the nymRef code beside the headword", () => {
        open();

        const row = screen.getByRole("menuitemradio", { name: /Find/ });
        expect(row).toHaveTextContent("Find");
        expect(row).toHaveTextContent("F64");
    });

    //Test: one count per visible column, in the order the columns are on screen
    it("prints one occurrence count per visible column", () => {
        open();

        expect(
            screen.getByRole("menuitemradio", { name: /^Find/ }),
        ).toHaveTextContent("21 · 16");
    });

    //Test: people and places are separate groups, each headed by its size
    it("groups the rows into people and places", () => {
        open();

        expect(screen.getByText(/Person \(3\)/)).toBeInTheDocument();
        expect(screen.getByText(/Place \(1\)/)).toBeInTheDocument();
    });

    //Test: nothing is offered that cannot match anything (#147) — the register
    //knows Temair, but no visible column names her
    it("leaves out an entity no visible column names", () => {
        open();

        expect(screen.queryByText("Temair")).not.toBeInTheDocument();
    });

    //Test: most-referenced first, so the people the passage is about are at the
    //top of a 91-row menu
    it("orders rows by how often the visible columns name them", () => {
        open();

        const people = rowLabels().filter((label) => !label.startsWith("Érend"));
        expect(people[0]).toMatch(/^Find/);
        expect(people[1]).toMatch(/^Caílti/);
        expect(people[2]).toMatch(/^Ḟinn/);
    });

    //Test: the source file's typo keeps a row of its own — two near-identical
    //rows are the signal to fix the file, not something to correct here
    it("shows a mistyped group id as its own row", () => {
        open();

        const row = screen.getByRole("menuitemradio", { name: /Ḟinn/ });
        expect(row).toHaveTextContent("64");
        expect(row).toHaveTextContent("0 · 1");
    });

    //Test: selecting a row is what every column then follows
    it("follows the entity a row names when it is clicked", () => {
        open();

        fireEvent.click(screen.getByRole("menuitemradio", { name: /^Find/ }));

        expect(useWorkspaceStore.getState().selectedEntityId).toBe("F64");
        expect(screen.getByRole("button", { name: /Find/ })).toBeInTheDocument();
    });

    //Test: clicking the row you are already following is the way back
    it("stops following when the selected row is clicked again", () => {
        open();
        const row = screen.getByRole("menuitemradio", { name: /^Find/ });

        fireEvent.click(row);
        fireEvent.click(screen.getByRole("menuitemradio", { name: /^Find/ }));

        expect(useWorkspaceStore.getState().selectedEntityId).toBeNull();
    });

    //Test: at 91 rows, typing is faster than scrolling
    it("filters the rows by headword", () => {
        open();

        fireEvent.change(screen.getByLabelText(/filter named entities/i), {
            target: { value: "caíl" },
        });

        expect(rowLabels()).toEqual([expect.stringMatching(/^Caílti/)]);
    });

    //Test: and by code, because that is what a researcher holding a name list
    //has in front of them
    it("filters the rows by nymRef code", () => {
        open();

        fireEvent.change(screen.getByLabelText(/filter named entities/i), {
            target: { value: "e6" },
        });

        expect(rowLabels()).toEqual([expect.stringMatching(/^Érend/)]);
    });

    //Test: the reader is looking, not joining, so their typing is not held to
    //the corpus's case-sensitive ids
    it("filters case-insensitively", () => {
        open();

        fireEvent.change(screen.getByLabelText(/filter named entities/i), {
            target: { value: "FIND" },
        });

        expect(rowLabels()).toEqual([expect.stringMatching(/^Find/)]);
    });

    //Test: a filter belongs to one visit to the menu — the menu can be
    //dismissed by clicking away, so a kept one would hide rows from a reader
    //who never saw the box doing it
    it("forgets the filter when the menu is reopened", () => {
        open();
        fireEvent.change(screen.getByLabelText(/filter named entities/i), {
            target: { value: "caíl" },
        });

        fireEvent.click(screen.getByRole("button", { name: /all tags/i }));
        fireEvent.click(screen.getByRole("button", { name: /all tags/i }));

        expect(screen.getByLabelText(/filter named entities/i)).toHaveValue("");
        expect(rowLabels().length).toBe(4);
    });

    //Test: a filter that matches nothing says so rather than looking broken
    it("says when nothing matches the filter", () => {
        open();

        fireEvent.change(screen.getByLabelText(/filter named entities/i), {
            target: { value: "zzz" },
        });

        expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
        expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0);
    });

    //Test: a group can be folded away, and the count in its heading is what is
    //under it now — not what would be under it unfiltered
    it("collapses a group, and heads it with what the filter left in it", () => {
        open();

        fireEvent.change(screen.getByLabelText(/filter named entities/i), {
            target: { value: "n" },
        });
        const heading = screen.getByText(/Person \(2\)/);
        fireEvent.click(heading);

        // Folding one group leaves the other alone: Érend also carries an "n".
        expect(rowLabels()).toEqual([expect.stringMatching(/^Érend/)]);
    });

    //Test: choosing a work narrows the columns, and the counts narrow with them
    it("counts only the chosen work's columns", () => {
        const acallam: TEIWork = { id: 1, name: "Acallam", slug: "acallam" };
        openDocs(
            teiDoc("franA4", index({ F64: 21 }), acallam),
            teiDoc("leinster", index({ F64: 99 }), { id: 2, name: "Táin", slug: "tain" }),
        );
        useWorkspaceStore.setState({ selectedWorkId: acallam.id });
        open();

        expect(
            within(screen.getByRole("menuitemradio", { name: /^Find/ })).getByText("21"),
        ).toBeInTheDocument();
    });

    //Test: 91 rows have to go somewhere, and it is not into the toolbar or the
    //reading panes. jsdom cannot measure a layout, so what is asserted is the
    //structure that produces one: the rows scroll inside a bounded box of their
    //own, and the filter box sits outside it rather than scrolling away with
    //the rows it filters.
    it("scrolls the rows inside its own bounds, below a filter box that stays put", () => {
        open();
        const scroller = screen
            .getByRole("menuitemradio", { name: /^Find/ })
            .closest(".overflow-y-auto");

        expect(scroller).not.toBeNull();
        expect(scroller).not.toContainElement(
            screen.getByLabelText(/filter named entities/i),
        );
        expect(screen.getByRole("menu").className).toMatch(/max-h-/);
    });

    //Test: the element-name vocabulary stays gone — none of these was ever a
    //filter option that could match anything in this corpus (#147)
    it("no longer offers TEI element names as options", () => {
        open();

        for (const gone of ["Geographic Feature", "Organisation", "Referring String"]) {
            expect(screen.queryByText(gone)).not.toBeInTheDocument();
        }
    });

    //Test: nothing selected filters nothing, so the trigger reads "All Tags"
    it("labels the trigger All Tags", () => {
        render(<TagFilterButton />);

        expect(screen.getByRole("button")).toHaveTextContent("All Tags");
    });

    //Test: a selection left in the store by an earlier corpus resolves to no
    //entry, and the trigger falls back rather than rendering `undefined`
    it("keeps reading All Tags when the selected id matches no entry", () => {
        render(<TagFilterButton />);

        act(() => useWorkspaceStore.getState().setSelectedEntityId("fionn"));

        expect(screen.getByRole("button")).toHaveTextContent("All Tags");
    });

    //Test: with nothing open there is nothing to offer, and no crash
    it("offers nothing when no document is open", () => {
        openDocs();
        open();

        expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
    });

    //Test: a document parsed before the registry existed names nobody, rather
    //than breaking the menu
    it("survives a column with no name index", () => {
        openDocs(teiDoc("old", null));
        open();

        expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
    });

    //Test: and it says so about itself, not about the manuscripts — they are
    //full of named entities; what is missing is a name for the group
    it("says the filter has nothing to offer, not that the text has no names", () => {
        useNameRegistryStore.setState({ entities: [] });
        open();

        expect(screen.getByText(/no named entities to filter by/i)).toBeInTheDocument();
        expect(screen.queryByText(/in the open documents/i)).not.toBeInTheDocument();
    });

    //Test: empty is empty — no kind headings, and no filter box for nothing
    it("shows no headings and no filter box when there is nothing to offer", () => {
        useNameRegistryStore.setState({ entities: [] });
        open();

        expect(screen.queryByText(/Person \(/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Place \(/)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/filter named entities/i)).not.toBeInTheDocument();
    });
});

// The trigger's label is the selected entity's headword — the only place on screen
// that says what the workspace is currently filtered to. The tag icon cannot say it,
// so this label outlives the ones that merely repeat their icon (#174).
describe("Tag Filter label survives the first collapse (#174)", () => {
    it("keeps its label down to `lg`, not just `xl`", () => {
        render(<TagFilterButton />);

        expect(screen.getByText(/All Tags/, { selector: "span" })).toHaveClass(
            "lg:inline",
        );
    });

    it("shows the selected entity's headword, so there is something to keep", () => {
        useWorkspaceStore.setState({ selectedEntityId: "F64" });
        render(<TagFilterButton />);

        const label = screen.getByText(/Find/, { selector: "span" });
        expect(label).toHaveClass("lg:inline");
    });
});
