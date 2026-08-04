from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema

from .models import (
    QUESTIONNAIRE_VERSION,
    QUESTIONS,
    BehaviorEvent,
    Feedback,
    QuestionnaireResponse,
)
from .serializers import (
    BehaviorEventRequestSerializer,
    FeedbackRequestSerializer,
    QuestionnaireDefinitionSerializer,
    QuestionnaireResponseRequestSerializer,
)


# controller for the pre-use purpose questionnaire (#67, ADR-0004; opened to guests by
# ADR-0007). Open access, like EventView below — attribution rides on request.user
# rather than being required for access.
class QuestionnaireView(APIView):

    @extend_schema(
        responses=QuestionnaireDefinitionSerializer,
        description="Current questionnaire version and its question set.",
    )
    def get(self, request):
        return Response({"version": QUESTIONNAIRE_VERSION, "questions": QUESTIONS})

    @extend_schema(
        request=QuestionnaireResponseRequestSerializer,
        responses={201: None},
        description="Record this session's questionnaire response, or that it was skipped.",
    )
    def post(self, request):
        serializer = QuestionnaireResponseRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user if request.user.is_authenticated else None
        QuestionnaireResponse.objects.create(
            user=user,
            questionnaire_version=QUESTIONNAIRE_VERSION,
            **serializer.validated_data,
        )
        return Response(status=status.HTTP_201_CREATED)


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
        # #68: attribution rides on who the server thinks is signed in, never on
        # anything the client sends — the request serializer has no user field, so a
        # stray one in the body is already dropped by validation before we get here.
        user = request.user if request.user.is_authenticated else None
        BehaviorEvent.objects.create(user=user, **serializer.validated_data)
        return Response(status=status.HTTP_201_CREATED)


# controller for visitor-written feedback (#137, ADR-0014). Open access like the two
# above — the floating button is available to guests, so requiring an account here would
# silence exactly the visitors most likely to hit a rough edge.
class FeedbackView(APIView):

    @extend_schema(
        request=FeedbackRequestSerializer,
        responses={201: None},
        description="Record one piece of visitor-written feedback.",
    )
    def post(self, request):
        serializer = FeedbackRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Same rule as EventView: who it belongs to is who the server thinks is signed
        # in, never anything the client sends.
        user = request.user if request.user.is_authenticated else None
        Feedback.objects.create(user=user, **serializer.validated_data)
        return Response(status=status.HTTP_201_CREATED)
