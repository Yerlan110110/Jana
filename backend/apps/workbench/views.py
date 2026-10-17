from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .selectors import workbench_for
from .serializers import WorkbenchQuerySerializer, WorkbenchSerializer


class WorkbenchView(APIView):
    @extend_schema(parameters=[WorkbenchQuerySerializer], responses=WorkbenchSerializer)
    def get(self, request):
        query = WorkbenchQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        result = workbench_for(request.user, **query.validated_data)
        return Response(WorkbenchSerializer(result, context={"request": request}).data)
