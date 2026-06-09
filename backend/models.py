"""
BrewTrade AI - SQLAlchemy ORM Models
All database models for the BrewTrade AI platform.
"""
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)  # plaintext for POC only
    role = Column(String, nullable=False)  # distributor / manager / executive
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="users")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    market = Column(String, nullable=False, index=True)  # e.g. Jamaica, Barbados
    credit_limit = Column(Float, default=0.0)
    outstanding_balance = Column(Float, default=0.0)
    credit_health = Column(String, default="green")  # green/yellow/red
    contact_name = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="customer")
    product_access = relationship("CustomerProductAccess", back_populates="customer")
    orders = relationship("Order", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")
    documents = relationship("Document", back_populates="customer")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False, index=True)  # beer/malt/shandy
    image_url = Column(String, nullable=True)
    base_price = Column(Float, nullable=False)
    moq = Column(Integer, default=1)
    available_quantity = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    approved_markets = Column(JSON, default=list)  # list of market strings
    created_at = Column(DateTime, default=datetime.utcnow)

    access_grants = relationship("CustomerProductAccess", back_populates="product")
    inventory_events = relationship("InventoryEvent", back_populates="product")


class CustomerProductAccess(Base):
    __tablename__ = "customer_product_access"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    customer_price = Column(Float, nullable=False)
    promotional_price = Column(Float, nullable=True)
    promo_active = Column(Boolean, default=False)

    customer = relationship("Customer", back_populates="product_access")
    product = relationship("Product", back_populates="access_grants")


class Merchandise(Base):
    __tablename__ = "merchandise"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # apparel/accessories/barware/trade_materials/campaign
    image_url = Column(String, nullable=True)
    price = Column(Float, nullable=False)
    moq = Column(Integer, default=1)
    stock = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    discount_percent = Column(Float, default=0.0)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    market = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    status = Column(String, default="submitted")
    # submitted/pending_approval/approved/processing/shipped/delivered/rejected
    total_value = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    expected_delivery = Column(DateTime, nullable=True)
    approved_by = Column(String, nullable=True)
    approval_notes = Column(Text, nullable=True)
    risk_score = Column(Float, nullable=True)
    ai_recommendation = Column(String, nullable=True)  # approve/reject/review
    notes = Column(Text, nullable=True)

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    status_history = relationship("OrderStatusHistory", back_populates="order", cascade="all, delete-orphan")
    ai_decisions = relationship("AIDecisionLog", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    merchandise_id = Column(Integer, ForeignKey("merchandise.id"), nullable=True)
    quantity_requested = Column(Integer, nullable=False)
    quantity_approved = Column(Integer, nullable=True)
    unit_price = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    status = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    actor = Column(String, nullable=True)  # system/distributor/manager/ai
    note = Column(Text, nullable=True)

    order = relationship("Order", back_populates="status_history")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    amount = Column(Float, nullable=False)
    balance = Column(Float, nullable=False)
    status = Column(String, default="open")  # open/closed/overdue
    invoice_date = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=False)

    customer = relationship("Customer", back_populates="invoices")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    doc_type = Column(String, nullable=False)  # export/statement/commercial_invoice/caricom/shipping
    filename = Column(String, nullable=False)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    file_path = Column(String, nullable=False)

    customer = relationship("Customer", back_populates="documents")


class InventoryEvent(Base):
    __tablename__ = "inventory_events"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    change = Column(Integer, nullable=False)  # +N or -N
    reason = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="inventory_events")


class SimulationLog(Base):
    __tablename__ = "simulation_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False)
    payload = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=datetime.utcnow)


class AIDecisionLog(Base):
    __tablename__ = "ai_decision_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    prompt = Column(Text, nullable=True)
    response = Column(JSON, default=dict)
    decision = Column(String, nullable=True)  # approve/reject/review
    risk_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="ai_decisions")
