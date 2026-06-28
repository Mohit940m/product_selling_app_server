# User API Routes Documentation

This documentation outlines the API endpoints available for Users (Buyers).

**Base URL:** `/api/v1/user`

---

## Table of Contents
1. Authentication
2. Products
3. Cart
4. Shipping
5. Order

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
Initiates the login process by looking up the user and sending an OTP. No password is required — the user is identified by email or phone number only.

- **Endpoint:** `POST /auth/login`
- **Auth Type:** None
- **Content-Type:** `application/json`

#### Request Body
At least one of `email` or `phone` must be provided.

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | String | No | Registered email address (required if `phone` not provided). |
| `phone` | String | No | Registered phone number (required if `email` not provided). |

**Sample Request:**
```json
{
  "email": "jane.doe@example.com"
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
- **Auth Type:** User auth

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
        "products": [
            {
                "_id": "697924cc247277aa1ef03f23",
                "name": "Classic T-Shirt",
                "description": "High quality cotton t-shirt",
                "category": "Men's Clothing",
                "images": [
                    "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769546956/e-commerce/products/dzsbr6tjae0xrh36l667.webp",
                    "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769546956/e-commerce/products/nr1dhymdx6ll4jr3d9gk.webp"
                ],
                "isActive": true,
                "isFeatured": false,
                "price": 500,
                "discountedPrice": 500,
                "activeOffer": null
            },
            {
                "_id": "697a69e77983d9c1cefdf91d",
                "name": "Men's 578 Blue Baggy Fit Mid Rise Jeans",
                "description": "These baggy fit jeans are known for their classic style, timeless appeal, and easy wearability. Made with sturdy denim that's been used for generations, these jeans will last you a lifetime. Levi's are the epitome of utilitarian fashion, and you can't go wrong with them.",
                "category": "Men's Clothing",
                "images": [
                    "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769630182/e-commerce/products/iz49zgj6vfahynwabdgy.webp",
                    "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769630182/e-commerce/products/hx67s4n860tjxq8ke496.webp",
                    "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769630182/e-commerce/products/b4iv1ta7irhsmucuhill.webp"
                ],
                "isActive": true,
                "isFeatured": false,
                "price": 2799,
                "discountedPrice": 2299,
                "activeOffer": {
                    "_id": "697a7cff8579a67c5eda1f75",
                    "name": "Flat 500 Off",
                    "type": "DISCOUNT",
                    "appliesTo": {
                        "productIds": [
                            "697a69e77983d9c1cefdf91d"
                        ],
                        "variantIds": [
                            "697a69e77983d9c1cefdf91f",
                            "697a69e77983d9c1cefdf920"
                        ],
                        "applyToAllVariants": true
                    },
                    "config": {
                        "discountType": "FLAT",
                        "value": 500
                    },
                    "minCartValue": 2000,
                    "validFrom": "2024-01-01T00:00:00.000Z",
                    "validTill": "2027-02-01T00:00:00.000Z",
                    "isStackable": false,
                    "isActive": true,
                    "createdAt": "2026-01-28T21:17:51.347Z",
                    "updatedAt": "2026-01-28T21:17:51.347Z",
                    "__v": 0
                }
            },
            {
                "_id": "697bcc089b9dbee534801d65",
                "name": "Men's 512 Light Blue Slim Tapered Fit Mid Rise Jeans",
                "description": "Everything you like about 512 Slim, but updated with a narrow-fit through the thigh and tapered leg for the fashion-forward guy. It's perfect for the modern look right now. This pair has just the right amount of stretch for all-day comfort and comes in a blue hue with the classic 5 pocket and a cotton material. Style it with our classic shirts and a pair of sneakers to complete your casual look.\n\n1. Sits below the waist\n2. Narrow leg for a more tailored look\n3. The perfect balance of slim and tapered",
                "category": "Denim Jeans",
                "images": [
                    "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769720840/e-commerce/products/stdkgiojk7ahrizfdy1z.jpg",
                    "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769720840/e-commerce/products/juwrvi3qu9u2iyx2gm9t.webp",
                    "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769720840/e-commerce/products/wfdgml0frez6rrl3i9en.webp"
                ],
                "isActive": true,
                "isFeatured": false,
                "price": 1500,
                "discountedPrice": 1400,
                "activeOffer": {
                    "_id": "697fbe145c155274614bf8b1",
                    "sellerId": "695ead153cf7e889fd825032",
                    "name": "10% Off Sale",
                    "type": "DISCOUNT",
                    "appliesTo": {
                        "productIds": [
                            "697bcc089b9dbee534801d65"
                        ],
                        "applyToAllVariants": true,
                        "variantIds": []
                    },
                    "config": {
                        "discountType": "PERCENTAGE",
                        "value": 10
                    },
                    "maxDiscountAmount": 100,
                    "validFrom": "2026-02-02T00:00:00.000Z",
                    "validTill": "2026-03-01T00:00:00.000Z",
                    "isStackable": false,
                    "isActive": true,
                    "createdAt": "2026-02-01T20:56:52.042Z",
                    "updatedAt": "2026-02-01T20:56:52.042Z",
                    "__v": 0
                }
            }
        ],
        "total": 3,
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
  "productId":"697a69e77983d9c1cefdf91d",
  "variantId":"697a69e77983d9c1cefdf91f",
  "quantity": 1
}
```

#### Sample Response
```json
{
    "success": true,
    "message": "Product added to cart successfully.",
    "data": {
        "_id": "6984f141537ee79db816cff1",
        "userId": "6957d144a8a7ada527a10434",
        "items": [
            {
                "productId": "697924cc247277aa1ef03f23",
                "variantId": "697924cc247277aa1ef03f25",
                "quantity": 1,
                "attributes": {
                    "Size": "M",
                    "Color": "Red"
                },
                "priceSnapshot": 500,
                "addedAt": "2026-02-05T19:36:33.985Z"
            },
            {
                "productId": "697a69e77983d9c1cefdf91d",
                "variantId": "697a69e77983d9c1cefdf91f",
                "quantity": 2,
                "attributes": {
                    "Size": "32",
                    "Color": "Blue"
                },
                "priceSnapshot": 2799,
                "addedAt": "2026-02-05T20:39:54.078Z"
            }
        ],
        "subTotal": 6098,
        "discount": 500,
        "total": 5598,
        "createdAt": "2026-02-05T19:36:34.001Z",
        "updatedAt": "2026-02-24T18:47:45.921Z",
        "__v": 1
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
        "_id": "6984f141537ee79db816cff1",
        "userId": "6957d144a8a7ada527a10434",
        "items": [
            {
                "productId": {
                    "_id": "697924cc247277aa1ef03f23",
                    "name": "Classic T-Shirt",
                    "category": "Men's Clothing",
                    "images": [
                        "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769546956/e-commerce/products/dzsbr6tjae0xrh36l667.webp",
                        "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769546956/e-commerce/products/nr1dhymdx6ll4jr3d9gk.webp"
                    ]
                },
                "variantId": {
                    "_id": "697924cc247277aa1ef03f25",
                    "sku": "TS-M-RED",
                    "attributes": {
                        "Size": "M",
                        "Color": "Red"
                    },
                    "price": 500,
                    "stock": 10
                },
                "quantity": 1,
                "attributes": {
                    "Size": "M",
                    "Color": "Red"
                },
                "priceSnapshot": 500,
                "addedAt": "2026-02-05T19:36:33.985Z",
                "price": 500,
                "discountedPrice": 500,
                "activeOffer": null,
                "savings": 0
            },
            {
                "productId": {
                    "_id": "697a69e77983d9c1cefdf91d",
                    "name": "Men's 578 Blue Baggy Fit Mid Rise Jeans",
                    "category": "Men's Clothing",
                    "images": [
                        "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769630182/e-commerce/products/iz49zgj6vfahynwabdgy.webp",
                        "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769630182/e-commerce/products/hx67s4n860tjxq8ke496.webp",
                        "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769630182/e-commerce/products/b4iv1ta7irhsmucuhill.webp"
                    ]
                },
                "variantId": {
                    "_id": "697a69e77983d9c1cefdf91f",
                    "sku": "DJ-32-BLUE",
                    "attributes": {
                        "Size": "32",
                        "Color": "Blue"
                    },
                    "price": 2799,
                    "stock": 10
                },
                "quantity": 1,
                "attributes": {
                    "Size": "32",
                    "Color": "Blue"
                },
                "priceSnapshot": 2799,
                "addedAt": "2026-02-05T20:39:54.078Z",
                "price": 2799,
                "discountedPrice": 2299,
                "activeOffer": {
                    "_id": "697a7cff8579a67c5eda1f75",
                    "name": "Flat 500 Off",
                    "type": "DISCOUNT",
                    "config": {
                        "discountType": "FLAT",
                        "value": 500
                    },
                    "minCartValue": 2000,
                    "isStackable": false
                },
                "savings": 500
            }
        ],
        "subTotal": 3299,
        "discount": 500,
        "total": 2799,
        "createdAt": "2026-02-05T19:36:34.001Z",
        "updatedAt": "2026-02-05T20:40:04.845Z",
        "__v": 1
    }
}
```

### 3. Remove From Cart
Removes a product from the user's shopping cart.


- **Endpoint:** `POST /cart/remove-from-cart`
- **Auth Type:** Bearer Token

#### Request Body

**Sample Request:**
```json
{ 
    "productId":"697a69e77983d9c1cefdf91d",
    "variantId":"697a69e77983d9c1cefdf91f"
}
```

#### Sample Response
```json
{
    "success": true,
    "message": "Item removed from cart successfully.",
    "data": {
        "_id": "6984f141537ee79db816cff1",
        "userId": "6957d144a8a7ada527a10434",
        "items": [
            {
                "productId": "697a69e77983d9c1cefdf91d",
                "variantId": "697a69e77983d9c1cefdf91f",
                "quantity": 3,
                "attributes": {
                    "Size": "32",
                    "Color": "Blue"
                },
                "priceSnapshot": 2799,
                "addedAt": "2026-02-05T20:39:54.078Z"
            }
        ],
        "subTotal": 8397,
        "discount": 500,
        "total": 7897,
        "createdAt": "2026-02-05T19:36:34.001Z",
        "updatedAt": "2026-02-24T18:52:37.704Z",
        "__v": 2
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
| Field              | Type   | Required | Description                  |
|--------------------|--------|----------|------------------------------|
| `destinationCity`  | String | Yes      | City of the buyer.           |
| `destinationState` | String | Yes      | State of the buyer.          |
| `productId`        | String | Yes      | Product ID (to identify seller config). |

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

---
---

## Order

### 1. Checkout
Calculates the final order summary including shipping, offers, and totals.

- **Endpoint:** `POST /order/checkout`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
The request body determines the shipping address used for calculation.

| Field | Type | Required | Description |
|---|---|---|---|
| `addressId` | String | No | ID of an existing address to use. |
| `fullName` | String | No | Full name (Required if creating new address). |
| `phone` | String | No | Phone number (Required if creating new address). |
| `addressLine1` | String | No | Address Line 1 (Required if creating new address). |
| `addressLine2` | String | No | Address Line 2. |
| `city` | String | No | City (Required if creating new address). |
| `state` | String | No | State (Required if creating new address). |
| `pincode` | String | No | Pincode (Required if creating new address). |
| `country` | String | No | Country (Default: India). |

**Scenario 1: Use Default Address (Empty Body)**
If the user has a default address saved, sending an empty body will use it.
```json
{}
```

**Scenario 2: Select Existing Address**
Use a specific address ID from the user's saved addresses.
```json
{
  "addressId": "698b969d694de382ebe5965c"
}
```

**Scenario 3: Add New Address**
Provide full address details to create a new address and use it for this checkout.
```json
{
  "fullName": "Rahul Roy",
  "phone": "9876543210",
  "addressLine1": "12/A, Park Street",
  "addressLine2": "Near Flurys",
  "city": "Kolkata",
  "state": "West Bengal",
  "pincode": "700016"
}
```

#### Sample Response
```json
{
    "success": true,
    "message": "Checkout summary calculated successfully.",
    "data": {
        "shippingAddress": {
            "_id": "698b969d694de382ebe5965c",
            "user": "6957d144a8a7ada527a10434",
            "fullName": "Rahul Roy",
            "phone": "9876543210",
            "addressLine1": "12/A, Park Street",
            "addressLine2": "Near Flurys",
            "city": "Kolkata",
            "state": "West Bengal",
            "pincode": "700016",
            "country": "India",
            "isDefault": true,
            "createdAt": "2026-02-10T20:35:41.912Z",
            "updatedAt": "2026-02-10T20:45:27.729Z",
            "__v": 0
        },
        "items": [
            {
                "productId": "697a69e77983d9c1cefdf91d",
                "variantId": "697a69e77983d9c1cefdf91f",
                "name": "Men's 578 Blue Baggy Fit Mid Rise Jeans",
                "image": "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769630182/e-commerce/products/iz49zgj6vfahynwabdgy.webp",
                "quantity": 3,
                "price": 2799,
                "discountedPrice": 2299,
                "total": 6897,
                "savings": 1500,
                "activeOffer": {
                    "_id": "697a7cff8579a67c5eda1f75",
                    "name": "Flat 500 Off",
                    "type": "DISCOUNT",
                    "config": {
                        "discountType": "FLAT",
                        "value": 500
                    }
                }
            }
        ],
        "breakdown": {
            "subTotal": 8397,
            "discount": 1500,
            "discountedAmount": 6897,
            "shipping": 30,
            "tax": 0,
            "total": 6927
        },
        "shippingDetails": [
            {
                "sellerId": "695ead153cf7e889fd825032",
                "cost": 30,
                "time": "1-2 Days",
                "type": "sameCity"
            }
        ]
    }
}
```

### 2. Create Order
Creates a pending order in the system and initiates a Razorpay payment order.

- **Endpoint:** `POST /order/create-order`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `addressId` | String | No | ID of the address to ship to. If not provided, uses the user's default address. |

**Sample Request:**
```json
{
  "addressId": "698b969d694de382ebe5965c"
}
```

#### Sample Response
```json
{
    "success": true,
    "message": "Order created successfully",
    "data": {
        "orderId": "698ce8f4981765c3653130d1",
        "razorpayOrderId": "order_Ok92384jsdKJs",
        "amount": 6927,
        "currency": "INR",
        "key": "rzp_test_...",
        "user": {
            "name": "Rahul Roy",
            "email": "rahul@example.com",
            "phone": "9876543210"
        }
    }
}
```

### 3. Verify Payment
Verifies the Razorpay payment signature and confirms the order.

- **Endpoint:** `POST /order/verify-payment`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
These fields come from the Razorpay client-side SDK after a successful payment.

| Field | Type | Required | Description |
|---|---|---|---|
| `razorpay_order_id` | String | Yes | Order ID returned by Razorpay. |
| `razorpay_payment_id` | String | Yes | Payment ID returned by Razorpay. |
| `razorpay_signature` | String | Yes | Signature hash returned by Razorpay. |

**Sample Request:**
```json
{
  "razorpay_order_id": "order_Ok92384jsdKJs",
  "razorpay_payment_id": "pay_29384723khjsd",
  "razorpay_signature": "b234827346238746283746283746287346..."
}
```

#### Sample Response
```json
{
    "success": true,
    "message": "Payment verified and order placed successfully.",
    "data": {
        "orderId": "698ce8f4981765c3653130d1"
    }
}
```
```