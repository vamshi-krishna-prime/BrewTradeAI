"""
BrewTrade AI - Auth router.

Implements simple POC authentication endpoints:
    POST /api/auth/login    - Validate username/password, return user payload.
    POST /api/auth/logout   - Stateless logout (POC).
    GET  /api/auth/me       - Return the same payload given a user_id.

NOTE: This is a POC. Passwords are stored in plaintext and no JWT/session
token is issued. The frontend simply remembers the returned payload.
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Customer, User
from schemas import LoginRequest


router = APIRouter(prefix="/api/auth", tags=["Auth"])


def _build_user_payload(user: User, customer: Optional[Customer]) -> Dict[str, Any]:
    """Build the standard auth payload returned by login and /me."""
    return {
        "user_id": user.id,
        "username": user.username,
        "role": user.role,
        "customer_id": user.customer_id,
        "customer_name": customer.name if customer else None,
        "market": customer.market if customer else None,
    }


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    POC login - looks up the user by username and verifies plaintext password.

    Returns a flat payload containing user id, role, the linked customer (if any),
    and that customer's market. Returns 401 if the user is not found or the
    password does not match.
    """
    try:
        user = (
            db.query(User)
            .filter(User.username == payload.username)
            .first()
        )
        if user is None or user.password != payload.password:
            raise HTTPException(status_code=401, detail="Invalid username or password")

        customer: Optional[Customer] = None
        if user.customer_id is not None:
            customer = db.query(Customer).filter(Customer.id == user.customer_id).first()

        return _build_user_payload(user, customer)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Login failed: {exc}")


@router.post("/logout")
def logout() -> Dict[str, bool]:
    """Stateless logout for POC - frontend discards its local user state."""
    return {"ok": True}


@router.get("/me")
def me(
    user_id: int = Query(..., description="ID of the currently signed-in user"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Return the same payload as /login for the given user_id.

    Used by the frontend on page reload to re-hydrate the session.
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")

        customer: Optional[Customer] = None
        if user.customer_id is not None:
            customer = db.query(Customer).filter(Customer.id == user.customer_id).first()

        return _build_user_payload(user, customer)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load session: {exc}")
