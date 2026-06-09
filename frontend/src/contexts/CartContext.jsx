import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useCallback,
} from 'react';

/**
 * BrewTrade AI - Cart Context
 * --------------------------------------------------------------------
 * Single source of truth for the customer cart across the Distributor
 * portal.  Items are persisted to localStorage so the basket survives
 * page reloads.  Items can be either products (kind: 'product') or
 * merchandise (kind: 'merchandise'); they are kept in one flat list so
 * the Cart screen can iterate uniformly while still letting callers
 * filter by kind.
 *
 * Item shape:
 * {
 *   id: string,            // unique cart-line key (e.g. 'product-12')
 *   kind: 'product' | 'merchandise',
 *   refId: number,         // underlying product.id or merchandise.id
 *   sku: string,
 *   name: string,
 *   category: string,
 *   image_url?: string,
 *   unit_price: number,    // price actually charged (promo if active)
 *   base_price?: number,   // original price for strikethrough display
 *   moq: number,
 *   available: number,     // stock or available_quantity
 *   quantity: number,
 *   promo_active?: boolean,
 * }
 */

const STORAGE_KEY = 'brewtrade.cart.v1';

const initialState = {
  items: [],
};

function readPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return initialState;
    return { items: parsed.items };
  } catch (_) {
    return initialState;
  }
}

function writePersisted(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    /* localStorage may be unavailable (SSR / private mode) */
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return action.payload || initialState;

    case 'ADD_ITEM': {
      const incoming = action.payload;
      const existing = state.items.find((i) => i.id === incoming.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === incoming.id
              ? { ...i, quantity: i.quantity + (incoming.quantity || 1) }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [...state.items, { ...incoming, quantity: incoming.quantity || 1 }],
      };
    }

    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload;
      if (quantity <= 0) {
        return { ...state, items: state.items.filter((i) => i.id !== id) };
      }
      return {
        ...state,
        items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
      };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.payload.id),
      };

    case 'CLEAR':
      return initialState;

    default:
      return state;
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, readPersisted);

  // Persist to localStorage on every change.
  useEffect(() => {
    writePersisted(state);
  }, [state]);

  // Cross-tab sync: pick up edits made in another tab.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          dispatch({ type: 'HYDRATE', payload: parsed });
        } catch (_) {
          /* ignore */
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const addItem = useCallback((item) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  }, []);

  const removeItem = useCallback((id) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  }, []);

  const updateQuantity = useCallback((id, quantity) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const { total, itemCount } = useMemo(() => {
    let t = 0;
    let n = 0;
    for (const i of state.items) {
      t += (i.unit_price || 0) * (i.quantity || 0);
      n += i.quantity || 0;
    }
    return { total: t, itemCount: n };
  }, [state.items]);

  const value = useMemo(
    () => ({
      items: state.items,
      total,
      itemCount,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
    }),
    [state.items, total, itemCount, addItem, removeItem, updateQuantity, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Hook to consume the cart.  Returns a stable no-op shape if used outside
 * of a CartProvider so components don't blow up during isolated tests.
 */
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    return {
      items: [],
      total: 0,
      itemCount: 0,
      addItem: () => {},
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
    };
  }
  return ctx;
}

/**
 * Helpers to build canonical cart line items from API payloads so callers
 * (catalog/merchandise pages) don't have to remember the exact shape.
 */
export function productToCartItem(product, quantity = 1) {
  const unitPrice =
    product.promo_active && product.promotional_price != null
      ? product.promotional_price
      : product.customer_price ?? product.base_price;
  return {
    id: `product-${product.id}`,
    kind: 'product',
    refId: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    image_url: product.image_url,
    unit_price: unitPrice,
    base_price: product.base_price,
    moq: product.moq || 1,
    available: product.available_quantity || 0,
    quantity,
    promo_active: !!product.promo_active,
  };
}

export function merchandiseToCartItem(merch, quantity = 1) {
  return {
    id: `merchandise-${merch.id}`,
    kind: 'merchandise',
    refId: merch.id,
    sku: merch.sku,
    name: merch.name,
    category: merch.category,
    image_url: merch.image_url,
    unit_price: merch.price,
    base_price: merch.price,
    moq: merch.moq || 1,
    available: merch.stock || 0,
    quantity,
    promo_active: false,
  };
}

export default CartContext;
