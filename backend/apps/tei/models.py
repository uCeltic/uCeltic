from django.db import models
from django.contrib.auth.models import User
from django.core.validators import FileExtensionValidator

# Create your models here.
class TEIDocument(models.Model):
    title = models.CharField(max_length=500)
    language = models.CharField(max_length=50, blank=True)
    xml_file = models.FileField(upload_to='tei/', validators=[FileExtensionValidator(allowed_extensions=['xml','tei'])])
    parsed_json = models.JSONField(blank=True, null=True)
    meta = models.JSONField(blank=True, null=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title
    
    class Meta:
        ordering = ['-created_at']