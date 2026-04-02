from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from auth import create_access_token, verify_password, get_current_user
from database import get_db
from limiter import limiter
from models import User, UserRole, Dispatcher
from schemas import LoginRequest, TokenResponse, UserProfile

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, req: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Dispatcher: email-based login against the Dispatcher table
    if req.role == "dispatcher":
        if not req.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email required for dispatcher login",
            )
        result = await db.execute(select(Dispatcher).where(Dispatcher.email == req.email))
        dispatcher = result.scalar_one_or_none()
        if dispatcher is None or not verify_password(req.password, dispatcher.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        token = create_access_token({
            "sub": str(dispatcher.id),
            "role": "dispatcher",
            "name": dispatcher.name,
        })
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user_id=dispatcher.id,
            role="dispatcher",
            name=dispatcher.name,
            dispatcher_id=dispatcher.id,
        )

    # Driver / hub_owner: phone-based login against the User table
    if not req.phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone required for driver/hub_owner login",
        )
    result = await db.execute(select(User).where(User.phone == req.phone))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password",
        )

    expected_role = UserRole.driver if req.role == "driver" else UserRole.hub_owner
    if user.role != expected_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is not registered as {req.role}",
        )

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role.value,
        "name": user.name,
    })

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role.value,
        name=user.name,
    )


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserProfile(
        user_id=current_user.id,
        role=current_user.role.value,
        name=current_user.name,
        phone=current_user.phone,
    )
