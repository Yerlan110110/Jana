from uuid import uuid4

import pytest

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    ("endpoint", "parameter", "foreign_attribute", "count_field"),
    [
        ("/api/v1/employees/", "department", "department_id", "count"),
        ("/api/v1/requests/", "employee", "pk", "count"),
        ("/api/v1/academy/enrollments/", "employee", "pk", "count"),
        ("/api/v1/academy/enrollments/summary/", "employee", "pk", "total"),
    ],
)
def test_relation_filters_do_not_reveal_hidden_object_existence(
    api_client, employees, endpoint, parameter, foreign_attribute, count_field
):
    api_client.force_authenticate(employees["employee"].user)
    foreign_id = getattr(employees["other_entity"], foreign_attribute)
    for value in [foreign_id, uuid4()]:
        response = api_client.get(endpoint, {parameter: str(value)})
        assert response.status_code == 200
        assert response.data[count_field] == 0

    malformed = api_client.get(endpoint, {parameter: "not-a-uuid"})
    assert malformed.status_code == 400
