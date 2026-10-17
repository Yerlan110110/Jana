import uuid

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import TimestampedModel


class User(AbstractUser):
    class Role(models.TextChoices):
        EMPLOYEE = "employee", "Employee"
        MANAGER = "manager", "Manager"
        HR = "hr", "HR"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=16, choices=Role, default=Role.EMPLOYEE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class LegalEntity(TimestampedModel):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self):
        return self.name


class Department(TimestampedModel):
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=200)
    legal_entity = models.ForeignKey(
        LegalEntity, on_delete=models.PROTECT, related_name="departments"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["legal_entity", "code"], name="department_entity_code_unique"
            )
        ]
        ordering = ["name", "id"]

    def __str__(self):
        return self.name


class Employee(TimestampedModel):
    user = models.OneToOneField(User, on_delete=models.PROTECT, related_name="employee")
    external_id = models.CharField(max_length=80, unique=True)
    full_name = models.CharField(max_length=200)
    position = models.CharField(max_length=200)
    legal_entity = models.ForeignKey(
        LegalEntity, on_delete=models.PROTECT, related_name="employees"
    )
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="employees")
    manager = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="direct_reports"
    )
    hired_on = models.DateField()
    leave_balance = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    balance_as_of = models.DateField()
    locale = models.CharField(
        max_length=8, choices=[("ru", "Русский"), ("kk", "Қазақша")], default="ru"
    )
    is_active = models.BooleanField(default=True)
    source_revision = models.CharField(max_length=100, blank=True)
    synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["full_name", "id"]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(manager=models.F("id")), name="employee_not_own_manager"
            ),
            models.CheckConstraint(
                condition=models.Q(leave_balance__gte=0), name="employee_leave_balance_nonnegative"
            ),
        ]
        indexes = [models.Index(fields=["legal_entity", "manager"])]

    def clean(self):
        super().clean()
        if (
            self.department_id
            and self.legal_entity_id
            and self.department.legal_entity_id != self.legal_entity_id
        ):
            raise ValidationError(
                {"department": "Department must belong to the employee's legal entity."}
            )
        if self.manager_id:
            seen = {self.pk}
            current = self.manager
            while current:
                if current.pk in seen:
                    raise ValidationError({"manager": "Manager relationships cannot form a cycle."})
                if current.legal_entity_id != self.legal_entity_id:
                    raise ValidationError(
                        {"manager": "Manager must belong to the same legal entity."}
                    )
                seen.add(current.pk)
                current = current.manager

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.full_name
