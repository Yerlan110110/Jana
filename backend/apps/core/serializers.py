from rest_framework import serializers


class StrictSerializerMixin:
    def to_internal_value(self, data):
        if isinstance(data, dict):
            writable = {name for name, field in self.fields.items() if not field.read_only}
            invalid = set(data) - writable
            if invalid:
                raise serializers.ValidationError(
                    {name: ["This field cannot be supplied."] for name in sorted(invalid)}
                )
        return super().to_internal_value(data)


class StrictSerializer(StrictSerializerMixin, serializers.Serializer):
    pass


class StrictModelSerializer(StrictSerializerMixin, serializers.ModelSerializer):
    pass
