# Seller API Routes Documentation

This documentation outlines the API endpoints available for Sellers.

**Base URL:** `/api/v1/seller` (confirmed via `server.ts`'s
`app.use('/api/v1/seller', sellerRoutes)`)

---

## Table of Contents
1. Authentication
2. Products
3. Shipping
4. Offer
5. Orders

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

### 1. Get Cloudinary Upload Signature
Creates a short-lived signed upload payload for direct browser uploads to Cloudinary.

- **Endpoint:** `GET /products/cloudinary-signature`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Sample Response
```json
{
  "success": true,
  "message": "Cloudinary upload signature generated successfully.",
  "data": {
    "cloudName": "dgv0uypa9",
    "apiKey": "792549837822231",
    "timestamp": 1769545055,
    "folder": "e-commerce/products",
    "signature": "generated_cloudinary_signature"
  }
}
```

#### Frontend Flow
1. React Admin requests this signature.
2. React Admin uploads image files directly to Cloudinary using `file`, `api_key`, `timestamp`, `folder`, and `signature`.
3. Cloudinary returns `secure_url` and `public_id`.
4. React Admin sends product metadata to `POST /products/create-product` with `productImagesURL` containing the Cloudinary URLs.

### 2. Create Product
Creates a new product listing.

- **Endpoint:** `POST /products/create-product`
- **Auth Type:** Bearer Token
- **Content-Type:** `multipart/form-data`

#### Request Body (Form Data)
| Field | Type | Required | Description |
|---|---|---|---|
| `name` | String | Yes | Name of the product. |
| `description` | String | Yes | Detailed description. |
| `category` | String | Yes | Product category. |
| `productImages` | File[] | No | Product image files (Required if `productImagesURL` is empty). |
| `productImagesURL` | Text/JSON | No | Product image URLs (Required if `productImages` is empty). |
| `variantTypes` | Text (JSON String) | Yes | Product varientes. |
| `variants` | Text (JSON String) | Yes | Product varientes. |


#### Sample Response
```json
{
    "success": true,
    "message": "Product created successfully",
    "data": {
        "name": "Classic T-Shirt",
        "description": "High quality cotton t-shirt",
        "category": "Men's Clothing",
        "images": [
            "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769545055/e-commerce/products/i6hzk8rhdemgdclzqaqm.webp",
            "https://res.cloudinary.com/dgv0uypa9/image/upload/v1769545055/e-commerce/products/wamhvbh6uoou5otioi5x.webp"
        ],
        "variantTypes": [
            "Size",
            "Color"
        ],
        "isActive": true,
        "isDeleted": false,
        "isFeatured": false,
        "sellerId": "695ead153cf7e889fd825032",
        "_id": "69791d5f2a853102922c22b1",
        "createdAt": "2026-01-27T20:17:35.928Z",
        "updatedAt": "2026-01-27T20:17:35.928Z",
        "__v": 0
    }
}
```

### 3. Edit Product
Updates an existing product. Supports partial updates and image management.

- **Endpoint:** `PUT /products/edit-product/:productId`
- **Auth Type:** Bearer Token
- **Content-Type:** `multipart/form-data`

#### Request Body (Form Data)
`price` and `stock` are per-variant, not per-product — they aren't
edited here at all; see Increase Stock and the variant endpoints below.

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | String | No | New name. |
| `description` | String | No | New description. |
| `category` | String | No | New category. |
| `productImages` | File[] | No | New image files to add (Max 5 total per product, files preferred over `productImagesURL` if both are sent). |
| `productImagesURL` | Text/JSON | No | New image URLs to add (from the admin app's direct-to-Cloudinary upload) — used only if `productImages` files aren't present. |
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

### 4. Edit Product Status
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

### 5. Increase Stock
Adds stock to an existing product.

- **Endpoint:** `PATCH /products/increase-stock/:productId`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `variantId` | String | Yes | ID of the variant. |
| `addedStock` | Number | Yes | Amount to add to current stock. |

**Sample Request:**
```json
{
    "variantId": "69791d5f2a853102922c22b3",
    "addedStock": 10
}
```

#### Sample Response
```json
{
    "success": true,
    "message": "Stock increased successfully",
    "data": {
        "product": "69791d5f2a853102922c22b1",
        "variantId": "69791d5f2a853102922c22b3",
        "stock": 20,
        "productName": "Classic T-Shirt"
    }
}
```

### 6. Edit Variant Price
Updates the price of a single variant.

- **Endpoint:** `PATCH /products/edit-variant-price/:productId`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `variantId` | String | Yes | ID of the variant. |
| `price` | Number | Yes | New price (must be a positive number). |

**Sample Request:**
```json
{
    "variantId": "69791d5f2a853102922c22b3",
    "price": 2499
}
```

#### Sample Response
```json
{
    "success": true,
    "message": "Price updated successfully",
    "data": {
        "product": "69791d5f2a853102922c22b1",
        "variantId": "69791d5f2a853102922c22b3",
        "price": 2499,
        "productName": "Classic T-Shirt",
        "variant": "Size M, Color Blue"
    }
}
```

### 7. Edit Variant Status
Activates or deactivates a single variant.

- **Endpoint:** `PATCH /products/edit-variant-status/:productId`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `variantId` | String | Yes | ID of the variant. |
| `status` | Boolean | Yes | `true` for active, `false` for inactive. |

**Sample Request:**
```json
{
    "variantId": "69791d5f2a853102922c22b3",
    "status": false
}
```

#### Sample Response
```json
{
    "success": true,
    "message": "Variant status updated successfully: deactivated",
    "data": {
        "product": "69791d5f2a853102922c22b1",
        "isActive": false,
        "productName": "Classic T-Shirt"
    }
}
```

### 8. Get All Products
Fetches the seller's products with pagination, search, and filtering.

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

### 9. Get Product By ID
Fetches details of a specific product, including its variants.

- **Endpoint:** `GET /products/get-product/:productId`
- **Auth Type:** Bearer Token

#### Sample Response
```json
{
  "success": true,
  "message": "Product fetched successfully",
  "data": { "...": "product fields", "variants": [ { "...": "variant fields" } ] }
}
```

### 10. Add Variant
Adds a new variant to an existing product.

- **Endpoint:** `POST /products/add-variant/:productId`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `attributes` | Object | Yes | At least one key/value, e.g. `{ "Size": "M", "Color": "Blue" }`. |
| `price` | Number | Yes | Must be a positive number. |
| `stock` | Number | No | Must be non-negative if provided (default 0). |

**Sample Request:**
```json
{
    "attributes": { "Size": "L", "Color": "Red" },
    "price": 2499,
    "stock": 20
}
```

#### Sample Response
```json
{
    "success": true,
    "message": "Variant added successfully",
    "data": {
        "_id": "69791d5f2a853102922c22b4",
        "productId": "69791d5f2a853102922c22b1",
        "sku": "CLA-X7Z-L-RED",
        "attributes": { "Size": "L", "Color": "Red" },
        "price": 2499,
        "stock": 20,
        "isActive": true
    }
}
```

### 11. Delete Product (Soft)
Marks a product as deleted and inactive without removing it from the database.

- **Endpoint:** `DELETE /products/delete-product/:productId`
- **Auth Type:** Bearer Token

#### Sample Response
```json
{
  "success": true,
  "message": "Product soft deleted successfully"
}
```

### 12. Delete Product (Permanent)
Permanently deletes a product, its variants, and its Cloudinary images.
Irreversible.

- **Endpoint:** `DELETE /products/delete-product-permanent/:productId`
- **Auth Type:** Bearer Token

#### Sample Response
```json
{
  "success": true,
  "message": "Product, variants, and images permanently deleted."
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

``

## Offer

### 1. Create Offer
Creates a new offer for a product.


- **Endpoint:** `POST /offers/create-offer`
- **Auth Type:** Bearer Token

#### Request Body
```json
{
  "name": "10% Off Sale",
  "type": "DISCOUNT",
  "appliesTo":{
    "productIds":["697bcc089b9dbee534801d65"]
    },
  "validFrom": "2024-01-01T00:00:00.000Z",
  "validTill": "2024-02-01T00:00:00.000Z",
  "config": {
    "discountType": "PERCENTAGE",
    "value": 10
  },
  "maxDiscountAmount": 100
}

```
```json
{
  "name": "Wallet Cashback",
  "type": "CASHBACK",
  "appliesTo":{
    "productIds":["697bcc089b9dbee534801d65"]
    },
  "validFrom": "2024-01-01T00:00:00.000Z",
  "validTill": "2024-02-01T00:00:00.000Z",
  "config": {
    "amount": 50
  },
  "isActive": true
}

```
```json
{
  "name": "Flat 500 Off",
  "type": "DISCOUNT",
  "appliesTo":{
    "productIds":["697bcc089b9dbee534801d65"]
    },
  "validFrom": "2024-01-01T00:00:00.000Z",
  "validTill": "2024-02-01T00:00:00.000Z",
  "config": {
    "discountType": "FLAT",
    "value": 500
  },
  "minCartValue": 2000,
  "isActive": true
}
```
```json
{
  "name": "Buy 2 Get 1 Free",
  "type": "BUY_GET",
  "validFrom": "2024-01-01T00:00:00.000Z",
  "validTill": "2024-02-01T00:00:00.000Z",
  "config": {
    "buyQty": 2,
    "getQty": 1
  },
  "appliesTo": {
    "productIds": ["64f8b5f2a853102922c22b1"] 
  },
  "isActive": true
}
```

```json
{
  "name": "Summer Combo",
  "type": "PRODUCT_BUNDLE",
  "validFrom": "2024-01-01T00:00:00.000Z",
  "validTill": "2024-02-01T00:00:00.000Z",
  "config": {
    "bundleItems": [
        { "productId": "64f8b5f2a853102922c22b1", "quantity": 1 },
        { "productId": "64f8b5f2a853102922c22b2", "quantity": 1 }
    ],
    "bundlePrice": 999
  },
  "isActive": true
}

```


#### Sample Response
```json
{
    "success": true,
    "message": "Offer created successfully",
    "data": {
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
        "validFrom": "2024-01-01T00:00:00.000Z",
        "validTill": "2024-02-01T00:00:00.000Z",
        "isStackable": false,
        "isActive": true,
        "_id": "697fb62c65decba9b5deb132",
        "createdAt": "2026-02-01T20:23:08.083Z",
        "updatedAt": "2026-02-01T20:23:08.083Z",
        "__v": 0
    }
}
```

**Note:** the endpoint above was documented here as `POST /offer/create-offer`
(singular) for an unknown stretch of this file's history — the real
mount is `/offers` (plural, `sellerRoute.ts`'s
`router.use("/offers", offerManagementRoutes)`). Corrected above. This
matches exactly the bug the admin frontend's `OffersPage.tsx` had (fixed
this session, `product_selling_app_clinet_admin` commit `c509c70`) — it's
plausible this doc's stale path is where that call site's wrong URL
originally came from, though that's not something to confirm from here.

### 2. List Offers
Fetches all offers belonging to the authenticated seller.

- **Endpoint:** `GET /offers/`
- **Auth Type:** Bearer Token

#### Sample Response
```json
{
    "success": true,
    "message": "Offers fetched successfully",
    "data": [
        {
            "_id": "697fb62c65decba9b5deb132",
            "name": "10% Off Sale",
            "type": "DISCOUNT",
            "appliesTo": {
                "productIds": [
                    { "_id": "697bcc089b9dbee534801d65", "name": "...", "images": ["..."] }
                ],
                "applyToAllVariants": true,
                "variantIds": []
            },
            "config": { "discountType": "PERCENTAGE", "value": 10 },
            "validFrom": "2024-01-01T00:00:00.000Z",
            "validTill": "2024-02-01T00:00:00.000Z",
            "isActive": true
        }
    ]
}
```
`appliesTo.productIds`/`appliesTo.variantIds` arrive populated (name/images,
sku/attributes respectively) — see `getSellerOffers` in
`offerManagement.controller.ts`.

### 3. Enable/Disable Offer
Toggles an offer's `isActive` flag.

- **Endpoint:** `PATCH /offers/edit-offer-status/:offerId`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `isActive` | Boolean | Yes | New status. |

**Sample Request:**
```json
{
  "isActive": false
}
```

#### Sample Response
```json
{
  "success": true,
  "message": "Offer disabled successfully.",
  "data": { "_id": "697fb62c65decba9b5deb132", "isActive": false, "...": "..." }
}
```
Returns `404` if the offer doesn't exist or doesn't belong to this seller,
`400` if `:offerId` isn't a valid id or `isActive` isn't a boolean.

### 4. Delete Offer
Permanently deletes an offer. Unlike products, offers have no soft-delete
flag — this is a real, irreversible delete.

- **Endpoint:** `DELETE /offers/delete-offer/:offerId`
- **Auth Type:** Bearer Token

#### Sample Response
```json
{
  "success": true,
  "message": "Offer deleted successfully."
}
```
Returns `404` if the offer doesn't exist or doesn't belong to this seller,
`400` if `:offerId` isn't a valid id.

There is still no endpoint to edit an offer's own fields (name, config,
dates, targets) — only its `isActive` flag and whole-document delete.

---

## Orders

An order can contain several sellers' items, so every response contains
**only this seller's line items** plus `sellerSubtotal` (those lines at
purchase price). The order's own `totalAmount`, `discount`, `cashback`,
`shippingCost` and `tax` cover all sellers and are deliberately not
returned. Only `PAID` and `REFUNDED` orders are visible.

**Every item is its own sub-order**, with its own `subOrderId`
(`<orderId>-1`, `<orderId>-2`, ...), `status` and `tracking`, so each
product is shipped and tracked separately even when the buyer paid for
them together. The order's `orderStatus` summarises this seller's items:
the least advanced stage among them. `canUpdateStatus` is `true` while
the order is `PAID`.

### 1. List Orders
- **Endpoint:** `GET /orders`
- **Auth Type:** Bearer Token

#### Query Parameters
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | Number | `1` | Page number. |
| `limit` | Number | `10` | Items per page (max 50). |

#### Sample Response
```json
{
  "success": true,
  "data": [
    {
      "_id": "698ce8f4981765c3653130d1",
      "orderId": "ORD-1760000000000-4821",
      "createdAt": "2026-09-15T10:00:00.000Z",
      "paymentStatus": "PAID",
      "orderStatus": "CONFIRMED",
      "shippingAddress": { "fullName": "...", "phone": "...", "addressLine1": "...", "city": "Kolkata", "state": "West Bengal", "pincode": "700001", "country": "India" },
      "items": [
        {
          "subOrderId": "ORD-1760000000000-4821-1",
          "status": "SHIPPED",
          "tracking": { "courier": "Delhivery", "trackingId": "DLV123456", "trackingUrl": "https://www.delhivery.com/track/package/DLV123456" },
          "statusUpdatedAt": "2026-09-16T09:30:00.000Z",
          "productId": "698a...", "variantId": "698b...", "name": "Classic Tee", "image": "https://...", "priceAtPurchase": 499, "quantity": 2, "attributes": { "size": "M" }
        }
      ],
      "canUpdateStatus": true,
      "itemCount": 2,
      "sellerSubtotal": 998
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
}
```

### 2. Get Order
- **Endpoint:** `GET /orders/:orderId`
- **Auth Type:** Bearer Token

`:orderId` is the Mongo `_id`, the `ORD-...` id, or any item's
`subOrderId`. Same shape as one element of `data` above. Returns `404` if the
order doesn't exist, isn't paid/refunded, or contains none of this
seller's products.

### 3. Update Item Status
Moves one item (sub-order) forward through fulfilment:
`CONFIRMED → SHIPPED → OUT FOR DELIVERY → DELIVERED`. Stages can be
skipped (e.g. `CONFIRMED → DELIVERED`) but never moved backwards. Other
items in the same order — including other sellers' — are unaffected.

- **Endpoint:** `PATCH /orders/:orderId/items/:subOrderId/status`
- **Auth Type:** Bearer Token
- **Content-Type:** `application/json`

#### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `status` | String | Yes | `SHIPPED`, `OUT FOR DELIVERY` or `DELIVERED`. |
| `tracking` | Object | No | `{ courier, trackingId, trackingUrl }` for this item; replaces its existing tracking. `trackingUrl` must be `http(s)`. |

```json
{
  "status": "SHIPPED",
  "tracking": { "courier": "Delhivery", "trackingId": "DLV123456", "trackingUrl": "https://www.delhivery.com/track/package/DLV123456" }
}
```

#### Responses
- `200` — the updated order, same shape as *Get Order*.
- `400` — invalid `status` or `trackingUrl`.
- `404` — order not found or not `PAID`, or the item doesn't exist or isn't this seller's product.
- `409` — the target stage isn't later than the item's current one, or a concurrent update got there first.

`CANCELLED` can't be set here: items are already paid for and there is
no refund flow yet.
