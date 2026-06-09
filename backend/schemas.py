"""
BrewTrade AI - Pydantic v2 Schemas
Request and response shapes for all API endpoints.
"""
from datetime import datetime
from typing import Optional, List, Any, Dict

from pydantic import BaseModel, ConfigDict, Field


# ----- Base config helper -----
class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ============================================================
# USERS / AUTH
# ============================================================
class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(ORMModel):
    id: int
    username: str
    role: str
    customer_id: Optional[int] = None


class LoginResponse(BaseModel):
    user: UserOut
    token: Optional[str] = None  # placeholder for POC


# ============================================================
# CUSTOMER
# ============================================================
class CustomerBase(BaseModel):
    name: str
    market: str
    credit_limit: float = 0.0
    outstanding_balance: float = 0.0
    credit_health: str = "green"
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerOut(ORMModel, CustomerBase):
    id: int
    created_at: datetime


# ============================================================
# PRODUCT
# ============================================================
class ProductBase(BaseModel):
    sku: str
    name: str
    category: str
    image_url: Optional[str] = None
    base_price: float
    moq: int = 1
    available_quantity: int = 0
    description: Optional[str] = None
    approved_markets: List[str] = Field(default_factory=list)


class ProductCreate(ProductBase):
    pass


class ProductOut(ORMModel, ProductBase):
    id: int
    customer_price: Optional[float] = None  # filled per-customer at runtime
    promotional_price: Optional[float] = None
    promo_active: bool = False
    created_at: datetime


# ============================================================
# CUSTOMER PRODUCT ACCESS
# ============================================================
class CustomerProductAccessOut(ORMModel):
    id: int
    customer_id: int
    product_id: int
    customer_price: float
    promotional_price: Optional[float] = None
    promo_active: bool


# ============================================================
# MERCHANDISE
# ============================================================
class MerchandiseBase(BaseModel):
    sku: str
    name: str
    category: str
    image_url: Optional[str] = None
    price: float
    moq: int = 1
    stock: int = 0
    description: Optional[str] = None


class MerchandiseOut(ORMModel, MerchandiseBase):
    id: int
    created_at: datetime


# ============================================================
# PROMOTION
# ============================================================
class PromotionBase(BaseModel):
    title: str
    description: Optional[str] = None
    product_id: Optional[int] = None
    discount_percent: float = 0.0
    start_date: datetime
    end_date: datetime
    market: Optional[str] = None
    image_url: Optional[str] = None


class PromotionOut(ORMModel, PromotionBase):
    id: int
    created_at: datetime


# ============================================================
# ORDER
# ============================================================
class OrderItemCreate(BaseModel):
    product_id: Optional[int] = None
    merchandise_id: Optional[int] = None
    quantity: int


class OrderItemOut(ORMModel):
    id: int
    product_id: Optional[int] = None
    merchandise_id: Optional[int] = None
    quantity_requested: int
    quantity_approved: Optional[int] = None
    unit_price: float
    line_total: float


class OrderCreate(BaseModel):
    customer_id: int
    items: List[OrderItemCreate]
    notes: Optional[str] = None


class OrderStatusHistoryOut(ORMModel):
    id: int
    status: str
    timestamp: datetime
    actor: Optional[str] = None
    note: Optional[str] = None


class OrderOut(ORMModel):
    id: int
    order_number: str
    customer_id: int
    status: str
    total_value: float
    created_at: datetime
    expected_delivery: Optional[datetime] = None
    approved_by: Optional[str] = None
    approval_notes: Optional[str] = None
    risk_score: Optional[float] = None
    ai_recommendation: Optional[str] = None
    notes: Optional[str] = None
    items: List[OrderItemOut] = []
    status_history: List[OrderStatusHistoryOut] = []


class ApprovalRequest(BaseModel):
    order_id: int
    decision: str  # approve / reject
    notes: Optional[str] = None
    approved_quantities: Optional[Dict[int, int]] = None  # order_item_id -> qty


# ============================================================
# INVOICE / AR
# ============================================================
class InvoiceOut(ORMModel):
    id: int
    invoice_number: str
    customer_id: int
    order_id: Optional[int] = None
    amount: float
    balance: float
    status: str
    invoice_date: datetime
    due_date: datetime


class ARDashboardOut(BaseModel):
    customer_id: int
    credit_limit: float
    outstanding_balance: float
    available_credit: float
    credit_health: str
    invoices: List[InvoiceOut] = []


# ============================================================
# DOCUMENT
# ============================================================
class DocumentOut(ORMModel):
    id: int
    customer_id: Optional[int] = None
    doc_type: str
    filename: str
    title: str
    created_at: datetime
    file_path: str


# ============================================================
# INVENTORY
# ============================================================
class InventoryEventOut(ORMModel):
    id: int
    product_id: int
    change: int
    reason: Optional[str] = None
    timestamp: datetime


# ============================================================
# AI
# ============================================================
class AIRecommendation(BaseModel):
    order_id: int
    decision: str  # approve/reject/review
    risk_score: float
    confidence: float
    rationale: str
    flags: List[str] = Field(default_factory=list)
    recommended_quantities: Optional[Dict[int, int]] = None


class AIExplanation(BaseModel):
    order_id: int
    explanation: str
    factors: List[Dict[str, Any]] = Field(default_factory=list)


class AIAssistantRequest(BaseModel):
    message: str
    customer_id: Optional[int] = None
    context: Optional[Dict[str, Any]] = None


class AIAssistantResponse(BaseModel):
    reply: str
    suggested_actions: List[Dict[str, Any]] = Field(default_factory=list)


class ApprovalReportOut(BaseModel):
    order_id: int
    report_markdown: str
    generated_at: datetime


# ============================================================
# SIMULATION
# ============================================================
class SimulationRequest(BaseModel):
    scenario: str  # e.g. demand_spike / credit_freeze / market_disruption
    parameters: Optional[Dict[str, Any]] = None


class SimulationResult(BaseModel):
    scenario: str
    summary: str
    metrics: Dict[str, Any] = Field(default_factory=dict)
    timeline: List[Dict[str, Any]] = Field(default_factory=list)


# ============================================================
# ANALYTICS
# ============================================================
class ExecutiveKPIs(BaseModel):
    total_revenue: float
    total_orders: int
    avg_order_value: float
    pending_approval_count: int
    approved_count: int
    rejected_count: int
    top_products: List[Dict[str, Any]] = Field(default_factory=list)
    top_markets: List[Dict[str, Any]] = Field(default_factory=list)
    revenue_trend: List[Dict[str, Any]] = Field(default_factory=list)
    ai_accuracy: Optional[float] = None


class CustomerDashboardOut(BaseModel):
    customer: CustomerOut
    open_orders: int
    pending_approval: int
    delivered_last_30d: int
    outstanding_balance: float
    available_credit: float
    credit_health: str
    recent_orders: List[OrderOut] = []
    active_promotions: List[PromotionOut] = []


# ============================================================
# GENERIC
# ============================================================
class StatusResponse(BaseModel):
    status: str
    message: Optional[str] = None
    data: Optional[Any] = None
