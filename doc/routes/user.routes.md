# User API Routes Documentation

This documentation outlines the API endpoints available for Users (Buyers).

**Base URL:** `/api/v1/user`

---

## Table of Contents
1. Authentication
2. Products
3. Cart
4. Shipping

---

## Authentication

### 1. Register User
Registers a new user and sends an OTP to the provided email.

- **Endpoint:** `POST /auth/register`
- **Auth Type:** None
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `name` | String | Yes | Full name of the user. |
| `email` | String | Yes | Email address (must be unique). |
| `password` | String | Yes | Password (min 6 chars). |
| `phone` | String | No | Phone number. |

**Sample Request:**
```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "password": "securePassword123",
  "phone": "9876543210"
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "User registered successfully. Please verify OTP.",
  "otp": "123456",
  "email": "jane.doe@example.com"
}
```

### 2. Verify Registration OTP
Verifies the OTP sent during registration and logs the user in.

- **Endpoint:** `POST /auth/verify-registration`
- **Auth Type:** None
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `email` | String | Yes | The email used for registration. |
| `otp` | String | Yes | The OTP received via email. |

**Sample Request:**
```json
{
  "email": "jane.doe@example.com",
  "otp": "123456"
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "User verified and logged in successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR...",
  "user": {
    "_id": "64f8a...",
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "isEmailVerified": true
  }
}
```

### 3. Login User
Initiates the login process by verifying credentials and sending an OTP.

- **Endpoint:** `POST /auth/login`
- **Auth Type:** None
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `email` | String | Yes | Registered email address. |
| `password` | String | Yes | Password. |

**Sample Request:**
```json
{
  "email": "jane.doe@example.com",
  "password": "securePassword123"
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "OTP sent for login.",
  "otp": "654321"
}
```

### 4. Verify Login OTP
Verifies the login OTP and returns an authentication token.

- **Endpoint:** `POST /auth/verify-login`
- **Auth Type:** None
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `email` | String | Yes | Registered email address. |
| `otp` | String | Yes | The OTP received. |

**Sample Request:**
```json
{
  "email": "jane.doe@example.com",
  "otp": "654321"
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "User logged in successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR..."
}
```

---

## Products

### 1. Get All Products
Fetches products available in the marketplace with pagination, search, and filtering.

- **Endpoint:** `GET /products/get-all-products`
- **Auth Type:** None

#### Query Parameters
| Param | Description |
|---|---|
| `page` | Page number (default 1). |
| `limit` | Items per page (default 10). |
| `category` | Filter by category. |
| `search` | Search by product name. |

#### Sample Response
```json
{
  "success": true,
  "message": "Products fetched successfully",
  "data": {
    "products": [ ... ],
    "total": 50,
    "page": 1,
    "limit": 10
  }
}
```

### 2. Get Product By ID
Fetches details of a specific product.

- **Endpoint:** `GET /products/get-product/:productId`
- **Auth Type:** None

#### Sample Response
```json
{
  "success": true,
  "message": "Product fetched successfully",
  "data": { ... }
}
```

---

## Cart

### 1. Add to Cart
Adds a product to the user's shopping cart.

- **Endpoint:** `POST /cart/add-to-cart`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `productId` | String | Yes | ID of the product. |
| `quantity` | Number | Yes | Quantity to add. |

**Sample Request:**
```json
{
  "productId": "64f8b...",
  "quantity": 1
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "Product added to cart successfully",
  "data": {
    "cart": [ ... ]
  }
}
```

### 2. Get Cart
Retrieves the user's current cart items.

- **Endpoint:** `GET /cart/get-cart`
- **Auth Type:** Bearer Token

#### Sample Response
```json
{
  "success": true,
  "message": "Cart fetched successfully",
  "data": {
    "items": [ ... ],
    "totalPrice": 2000
  }
}
```

---

## Shipping

### 1. Calculate Shipping Cost
Calculates shipping cost for a destination.

- **Endpoint:** `POST /shipping/calculate-shipping-cost`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `destinationCity` | String | Yes | City of the buyer. |
| `destinationState` | String | Yes | State of the buyer. |
| `productId` | String | Yes | Product ID (to identify seller config). |

**Sample Request:**
```json
{
  "destinationCity": "Pune",
  "destinationState": "Maharashtra",
  "productId": "64f8b..."
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "Shipping calculated successfully.",
  "data": {
    "cost": 60,
    "time": "2-3 Days"
  }
}
```