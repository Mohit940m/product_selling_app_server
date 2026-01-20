# Seller API Routes Documentation

This documentation outlines the API endpoints available for Sellers.

**Base URL:** `/api/v1/seller` (Assumed based on typical configuration, adjust if mounted differently)

---

## Table of Contents
1. Authentication
2. Products
3. Shipping

---

## Authentication

### 1. Register Seller
Registers a new seller and sends an OTP to the provided email.

- **Endpoint:** `POST /auth/register`
- **Auth Type:** None
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `name` | String | Yes | Full name of the seller. |
| `email` | String | Yes | Email address (must be unique). |
| `password` | String | Yes | Password (min 6 chars). |
| `phone` | String | No | Phone number (must be unique if provided). |

**Sample Request:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "securePassword123",
  "phone": "9876543210"
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "Seller registered successfully. Please verify OTP.",
  "otp": "123456",
  "email": "john.doe@example.com"
}
```

### 2. Verify Registration OTP
Verifies the OTP sent during registration and logs the seller in.

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
  "email": "john.doe@example.com",
  "otp": "123456"
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "Seller verified and logged in successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR...",
  "seller": {
    "_id": "64f8a...",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "isEmailVerified": true
  }
}
```

### 3. Login Seller
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
  "email": "john.doe@example.com",
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
  "email": "john.doe@example.com",
  "otp": "654321"
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "Seller logged in successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR..."
}
```

---

## Products

### 1. Create Product
Creates a new product listing.

- **Endpoint:** `POST /products/create-product`
- **Auth Type:** Bearer Token
- **Content-Type:** `multipart/form-data`

#### Request Body (Form Data)
| Field | Type | Required | Description |
|---|---|---|---|
| `name` | String | Yes | Name of the product. |
| `description` | String | Yes | Detailed description. |
| `price` | Number | Yes | Price of the product. |
| `category` | String | Yes | Product category. |
| `stock` | Number | No | Initial stock (default 0). |
| `images` | File[] | Yes | At least one image file. |

#### Sample Response
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "_id": "64f8b...",
    "name": "Wireless Headphones",
    "price": 2000,
    "images": ["url1", "url2"]
  }
}
```

### 2. Edit Product
Updates an existing product. Supports partial updates and image management.

- **Endpoint:** `PUT /products/edit-product/:productId`
- **Auth Type:** Bearer Token
- **Content-Type:** `multipart/form-data`

#### Request Body (Form Data)
| Field | Type | Required | Description |
|---|---|---|---|
| `name` | String | No | New name. |
| `description` | String | No | New description. |
| `price` | Number | No | New price. |
| `category` | String | No | New category. |
| `stock` | Number | No | New stock count. |
| `images` | File[] | No | New images to add (Max 5 total per product). |
| `imagesToDelete` | String/Array | No | URLs of existing images to remove. |

#### Sample Response
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "_id": "64f8b...",
    "name": "Wireless Headphones Pro",
    "price": 2500
  }
}
```

### 3. Edit Product Status
Activates or deactivates a product.

- **Endpoint:** `PATCH /products/edit-product-status/:productId`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `status` | Boolean | Yes | `true` for active, `false` for inactive. |

**Sample Request:**
```json
{
  "status": true
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "Product status updated successfully: activated",
  "data": {
    "product": "64f8b...",
    "isActive": true,
    "productName": "Wireless Headphones Pro"
  }
}
```

### 4. Increase Stock
Adds stock to an existing product.

- **Endpoint:** `PATCH /products/increase-stock/:productId`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `addedStock` | Number | Yes | Amount to add to current stock. |

**Sample Request:**
```json
{
  "addedStock": 50
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "Product stock increased successfully",
  "data": {
    "product": "64f8b...",
    "stock": 150,
    "productName": "Wireless Headphones Pro"
  }
}
```

### 5. Get All Products
Fetches products with pagination, search, and filtering.

- **Endpoint:** `GET /products/get-all-products`
- **Auth Type:** Bearer Token

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

### 6. Get Product By ID
Fetches details of a specific product.

- **Endpoint:** `GET /products/get-product/:productId`
- **Auth Type:** Bearer Token

#### Sample Response
```json
{
  "success": true,
  "message": "Product fetched successfully",
  "data": { ... }
}
```

---

## Shipping

### 1. Get Shipping Config
Retrieves the seller's current shipping configuration.

- **Endpoint:** `GET /shipping/get-shipping-config`
- **Auth Type:** Bearer Token

#### Sample Response
```json
{
    "success": true,
    "message": "Shipping configuration fetched successfully.",
    "data": {
        "origin": {
            "city": "kolkata",
            "state": "west bengal",
            "region": "east"
        },
        "shippingRates": {
            "sameCity": {
                "cost": 50,
                "time": "1-2 Days"
            },
            "sameState": {
                "cost": 100,
                "time": "2-3 Days"
            },
            "sameRegion": {
                "cost": 150,
                "time": "3-5 Days"
            },
            "restOfIndia": {
                "cost": 200,
                "time": "5-7 Days"
            },
            "remote": {
                "cost": 300,
                "time": "7-10 Days"
            }
        },
        "_id": "696fb8526c6e8e7dad963f81",
        "sellerId": "695ead153cf7e889fd825032",
        "createdAt": "2026-01-20T17:16:03.011Z",
        "updatedAt": "2026-01-20T17:16:03.011Z",
        "__v": 0
    }
}
```

### 2. Create Shipping Config
Sets up the initial shipping configuration.

- **Endpoint:** `POST /shipping/create-shipping-config`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
Requires `origin` and `shippingRates` objects.

**Sample Request:**
```json
{
  "origin": {
    "city": "kolkata",
    "state": "west bengal"
  },
  "shippingRates": {
    "sameCity": {
      "cost": 30,
      "time": "1-2 Days"
    },
    "sameState": {
      "cost": 50,
      "time": "2-3 Days"
    },
    "sameRegion": {
      "cost": 70,
      "time": "3-5 Days"
    },
    "restOfIndia": {
      "cost": 100,
      "time": "5-7 Days"
    },
    "remote": {
      "cost": 150,
      "time": "7-10 Days"
    }
  }
}
```

#### Sample Response
```json
{
    "success": true,
    "message": "Shipping configuration updated successfully.",
    "data": {
        "origin": {
            "city": "kolkata",
            "state": "west bengal"
        },
        "shippingRates": {
            "sameCity": {
                "cost": 30,
                "time": "1-2 Days"
            },
            "sameState": {
                "cost": 50,
                "time": "2-3 Days"
            },
            "sameRegion": {
                "cost": 70,
                "time": "3-5 Days"
            },
            "restOfIndia": {
                "cost": 100,
                "time": "5-7 Days"
            },
            "remote": {
                "cost": 150,
                "time": "7-10 Days"
            }
        },
        "_id": "696fb8526c6e8e7dad963f81",
        "sellerId": "695ead153cf7e889fd825032",
        "createdAt": "2026-01-20T17:16:03.011Z",
        "updatedAt": "2026-01-20T18:08:23.278Z",
        "__v": 0
    }
}
```

### 3. Update Shipping Config
Updates specific parts of the shipping configuration (Origin or Rates).

- **Endpoint:** `PUT /shipping/update-shipping-config`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
Partial updates allowed.

**Sample Request:**
```json
{
  "shippingRates": {
    "sameCity": { "cost": 45, "time": "1 Day" }
  }
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "Shipping configuration updated successfully.",
  "data": { ... }
}
```

### 4. Calculate Shipping Cost
Calculates shipping cost for a destination based on the seller's config.

- **Endpoint:** `POST /shipping/calculate-shipping-cost`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `destinationCity` | String | Yes | City of the buyer. |
| `destinationState` | String | Yes | State of the buyer. |

**Sample Request:**
```json
{
  "destinationCity": "Pune",
  "destinationState": "Maharashtra"
}
```

#### Sample Response
```json
{
    "success": true,
    "message": "Shipping calculated successfully.",
    "data": {
        "cost": 100,
        "time": "5-7 Days",
        "type": "restOfIndia"
    }
}
```