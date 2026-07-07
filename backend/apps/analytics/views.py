from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema

from .models import BehaviorEvent
from .serializers import BehaviorEventRequestSerializer

# controller for the behavior-event ingest api
class EventView(APIView):

    @extend_schema(
        request=BehaviorEventRequestSerializer,
        responses={201: None},
        description="Ingest one behavior event from the closed taxonomy.",
    )
    def post(self, request):
        serializer = BehaviorEventRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        BehaviorEvent.objects.create(**serializer.validated_data)
        return Response(status=status.HTTP_201_CREATED)