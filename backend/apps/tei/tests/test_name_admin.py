"""Editing a headword in admin is a claim a human made, and it has to say so.

The corpus supplies no name for a group, so every headword in the register is
derived from spellings the annotators happened to write most often. That is a
guess, and the admin form is where a researcher replaces it — after which no
upload may quietly take it back.
"""
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory, TestCase

from apps.tei.admin import NameEntityAdmin
from apps.tei.models import NameEntity


class NameEntityAdminTest(TestCase):
    def setUp(self):
        self.admin = NameEntityAdmin(NameEntity, AdminSite())
        self.request = RequestFactory().post("/admin/")
        self.entity = NameEntity.objects.create(
            code="F64", kind="person", headword="Find",
        )

    def save(self, entity, changed):
        class Form:
            changed_data = changed

        self.admin.save_model(self.request, entity, Form(), change=True)

    def test_editing_the_headword_marks_it_as_a_human_s_choice(self):
        self.entity.headword = "Find mac Cumaill"
        self.save(self.entity, ["headword"])

        self.entity.refresh_from_db()
        self.assertEqual(self.entity.headword, "Find mac Cumaill")
        self.assertEqual(self.entity.headword_source, NameEntity.MANUAL)

    def test_saving_without_touching_the_headword_leaves_it_derived(self):
        self.save(self.entity, [])

        self.entity.refresh_from_db()
        self.assertEqual(self.entity.headword_source, NameEntity.DERIVED)

    def test_an_entity_cannot_be_invented_by_hand(self):
        # An entity exists because a manuscript names it. One added here would
        # be a menu option that can never match anything in any column.
        self.assertFalse(self.admin.has_add_permission(self.request))

    def test_the_group_id_is_the_corpus_s_and_is_not_editable(self):
        # It is the key every occurrence carries; editing it would orphan the
        # group rather than rename it.
        self.assertIn("code", self.admin.readonly_fields)
