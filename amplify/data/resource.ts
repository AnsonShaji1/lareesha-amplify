import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { createOrder } from '../functions/create-order/resource';
import { verifyPayment } from '../functions/verify-payment/resource';
import { paymentFailed } from '../functions/payment-failed/resource';
import { calculateCheckoutTotals } from '../functions/calculate-checkout-totals/resource';
import { validatePincode } from '../functions/validate-pincode/resource';
import { getHomepage } from '../functions/get-homepage/resource';
import { productAvailability } from '../functions/product-availability/resource';
import { getMediaUploadUrl } from '../functions/get-media-upload-url/resource';
import { deleteMedia } from '../functions/delete-media/resource';
import { catalogSeed } from '../functions/catalog-seed/resource';
import { allocateProductCode } from '../functions/allocate-product-code/resource';
import { setDefaultAddress } from '../functions/set-default-address/resource';
import { listUsers } from '../functions/list-users/resource';

const schema = a.schema({
  ProductImage: a.customType({
    url: a.string().required(),
    order: a.integer().required(),
  }),

  OrderItemSnapshot: a.customType({
    productId: a.id().required(),
    productName: a.string().required(),
    productPricePaise: a.integer().required(),
    productUrl: a.string(),
    productImage: a.string(),
    quantity: a.integer().required(),
    lineTotalPaise: a.integer().required(),
  }),

  HomepageCategory: a.customType({
    id: a.id().required(),
    name: a.string().required(),
    slug: a.string().required(),
    imageUrl: a.string(),
  }),

  HomepageProduct: a.customType({
    id: a.id().required(),
    productCode: a.string(),
    name: a.string().required(),
    description: a.string(),
    originalPricePaise: a.integer().required(),
    salePricePaise: a.integer().required(),
    images: a.string().array(),
    categoryId: a.id(),
    categoryName: a.string(),
    categorySlug: a.string(),
    newIn: a.boolean(),
    noOfStock: a.integer(),
    availableStock: a.integer(),
  }),

  HomepageSection: a.customType({
    category: a.ref('HomepageCategory'),
    products: a.ref('HomepageProduct').array(),
    productCount: a.integer(),
  }),

  ProductAvailability: a.customType({
    id: a.id().required(),
    availableStock: a.integer().required(),
  }),

  HomepagePayload: a.customType({
    categories: a.ref('HomepageCategory').array(),
    newArrivals: a.ref('HomepageProduct').array(),
    newArrivalsCount: a.integer(),
    categorySections: a.ref('HomepageSection').array(),
  }),

  CheckoutItem: a.customType({
    productId: a.id().required(),
    productName: a.string().required(),
    quantity: a.integer().required(),
    pricePaise: a.integer().required(),
    taxPercentageBps: a.integer().required(),
  }),

  CheckoutTotals: a.customType({
    subtotalPaise: a.integer().required(),
    shippingPaise: a.integer().required(),
    taxPaise: a.integer().required(),
    totalPaise: a.integer().required(),
    shippingPendingAddress: a.boolean(),
    items: a.ref('CheckoutItem').array(),
  }),

  CreateOrderResult: a.customType({
    id: a.id().required(),
    orderNumber: a.string().required(),
    razorpayOrderId: a.string(),
    razorpayKey: a.string(),
    amountPaise: a.integer(),
    subtotalPaise: a.integer(),
    shippingPaise: a.integer(),
    taxPaise: a.integer(),
    totalPaise: a.integer(),
    reservationExpiresAt: a.string(),
    status: a.string(),
    paymentStatus: a.string(),
  }),

  PostOffice: a.customType({
    name: a.string(),
    city: a.string(),
    state: a.string(),
  }),

  PincodeValidation: a.customType({
    valid: a.boolean().required(),
    pincode: a.string(),
    cities: a.string().array(),
    states: a.string().array(),
    postOffices: a.ref('PostOffice').array(),
    error: a.string(),
  }),

  MediaUpload: a.customType({
    uploadUrl: a.string().required(),
    publicUrl: a.string().required(),
    key: a.string().required(),
  }),

  ShopUser: a.customType({
    username: a.string().required(),
    sub: a.string(),
    name: a.string().required(),
    email: a.string(),
    phone: a.string(),
    status: a.string().required(),
    group: a.string().required(),
    createdAtIso: a.string().required(),
  }),

  Category: a
    .model({
      name: a.string().required(),
      slug: a.string().required(),
      imageUrl: a.string(),
      createdAtIso: a.string().required(),
    })
    .secondaryIndexes((index) => [index('slug').queryField('listCategoriesBySlug')])
    .authorization((allow) => [
      allow.publicApiKey().to(['read']),
      allow.guest().to(['read']),
      allow.authenticated().to(['read']),
      allow.group('admin'),
    ]),

  Product: a
    .model({
      name: a.string().required(),
      description: a.string(),
      originalPricePaise: a.integer().required(),
      salePricePaise: a.integer().required(),
      categoryId: a.id().required(),
      categoryName: a.string(),
      categorySlug: a.string(),
      newIn: a.boolean().required(),
      newInKey: a.string(),
      listingKey: a.string().required(),
      priceKey: a.string().required(),
      noOfStock: a.integer().required(),
      taxPercentageBps: a.integer().required(),
      images: a.json(),
      productCode: a.string(),
      createdAtIso: a.string().required(),
    })
    .secondaryIndexes((index) => [
      index('categoryId')
        .sortKeys(['createdAtIso'])
        .queryField('listProductsByCategory'),
      index('newInKey').sortKeys(['createdAtIso']).queryField('listProductsByNewIn'),
      index('priceKey').sortKeys(['salePricePaise']).queryField('listProductsByPrice'),
      index('listingKey').sortKeys(['createdAtIso']).queryField('listProductsByRecent'),
    ])
    .authorization((allow) => [
      allow.publicApiKey().to(['read']),
      allow.guest().to(['read']),
      allow.authenticated().to(['read']),
      allow.group('admin'),
    ]),

  Address: a
    .model({
      fullName: a.string().required(),
      phone: a.string().required(),
      email: a.email().required(),
      addressLine1: a.string().required(),
      addressLine2: a.string(),
      city: a.string().required(),
      state: a.string().required(),
      zipCode: a.string().required(),
      country: a.string().required(),
      isDefault: a.boolean().required(),
      userId: a.string().required(),
      createdAtIso: a.string().required(),
    })
    .secondaryIndexes((index) => [index('userId').queryField('listAddressesByOwner')])
    .authorization((allow) => [allow.owner(), allow.group('admin').to(['read'])]),

  CartItem: a
    .model({
      productId: a.id().required(),
      quantity: a.integer().required(),
      userId: a.string().required(),
      createdAtIso: a.string().required(),
    })
    .secondaryIndexes((index) => [index('userId').sortKeys(['createdAtIso']).queryField('listCartByOwner')])
    .authorization((allow) => [allow.owner(), allow.group('admin').to(['create', 'read', 'update', 'delete'])]),

  WishlistItem: a
    .model({
      productId: a.id().required(),
      userId: a.string().required(),
      createdAtIso: a.string().required(),
    })
    .secondaryIndexes((index) => [
      index('userId').sortKeys(['createdAtIso']).queryField('listWishlistByOwner'),
    ])
    .authorization((allow) => [allow.owner(), allow.group('admin').to(['create', 'read', 'update', 'delete'])]),

  Order: a
    .model({
      orderNumber: a.string().required(),
      shippingFullName: a.string().required(),
      shippingPhone: a.string().required(),
      shippingEmail: a.email().required(),
      shippingAddressLine1: a.string().required(),
      shippingAddressLine2: a.string(),
      shippingCity: a.string().required(),
      shippingState: a.string().required(),
      shippingZipCode: a.string().required(),
      shippingCountry: a.string().required(),
      subtotalPaise: a.integer().required(),
      shippingPaise: a.integer().required(),
      taxPaise: a.integer().required(),
      totalPaise: a.integer().required(),
      status: a.string().required(),
      paymentStatus: a.string().required(),
      razorpayOrderId: a.string(),
      razorpayPaymentId: a.string(),
      razorpaySignature: a.string(),
      stockReserved: a.boolean().required(),
      reservationExpiresAt: a.string(),
      /** ISO timestamp set by order-emails after SES send succeeds (idempotency). */
      orderEmailSentAt: a.string(),
      items: a.json(),
      userId: a.string().required(),
      createdAtIso: a.string().required(),
    })
    .secondaryIndexes((index) => [
      index('userId').sortKeys(['createdAtIso']).queryField('listOrdersByOwner'),
      index('razorpayOrderId').queryField('listOrdersByRazorpayOrderId'),
      index('orderNumber').queryField('listOrdersByNumber'),
    ])
    .authorization((allow) => [allow.owner().to(['read']), allow.group('admin').to(['read', 'update'])]),

  PaymentTransaction: a
    .model({
      orderId: a.id().required(),
      orderNumber: a.string().required(),
      subtotalPaise: a.integer().required(),
      shippingPaise: a.integer().required(),
      taxPaise: a.integer().required(),
      totalPaise: a.integer().required(),
      paymentMethod: a.string().required(),
      razorpayOrderId: a.string().required(),
      razorpayPaymentId: a.string().required(),
      razorpaySignature: a.string(),
      status: a.string().required(),
      userId: a.string().required(),
      createdAtIso: a.string().required(),
    })
    .secondaryIndexes((index) => [
      index('userId').sortKeys(['createdAtIso']).queryField('listPaymentsByOwner'),
      index('orderId').queryField('listPaymentsByOrder'),
    ])
    .authorization((allow) => [allow.owner().to(['read']), allow.group('admin').to(['read'])]),

  StockReservation: a
    .model({
      orderId: a.id().required(),
      productId: a.id().required(),
      quantity: a.integer().required(),
      expiresAtIso: a.string().required(),
      expiresAtEpoch: a.integer().required(),
      createdAtIso: a.string().required(),
    })
    .secondaryIndexes((index) => [
      index('productId').sortKeys(['expiresAtEpoch']).queryField('listReservationsByProduct'),
      index('orderId').queryField('listReservationsByOrder'),
    ])
    .authorization((allow) => [allow.group('admin').to(['read'])]),

  // Single store-wide row; always create/update with id "default"
  Shipping: a
    .model({
      isFreeShipping: a.boolean().required(),
      feePaise: a.integer().required(),
      updatedAtIso: a.string().required(),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.group('admin'),
    ]),

  Sequence: a
    .model({
      name: a.string().required(),
      value: a.integer().required(),
    })
    .identifier(['name'])
    .authorization((allow) => [allow.group('admin').to(['read'])]),

  CatalogSeedJob: a
    .model({
      status: a.string().required(),
      resetCatalog: a.boolean().required(),
      resetOrders: a.boolean().required(),
      jsonKey: a.string(),
      totalProducts: a.integer().required(),
      processedProducts: a.integer().required(),
      createdProducts: a.integer().required(),
      createdCategories: a.integer().required(),
      createdImages: a.integer().required(),
      errorMessage: a.string(),
      itemErrors: a.json(),
      createdBy: a.string(),
      startedAt: a.string(),
      completedAt: a.string(),
      createdAtIso: a.string().required(),
    })
    .authorization((allow) => [allow.group('admin')]),

  getHomepage: a
    .query()
    .arguments({
      includeNewArrivals: a.boolean(),
      includeCategorySections: a.boolean(),
      sectionLimit: a.integer(),
    })
    .returns(a.ref('HomepagePayload'))
    .authorization((allow) => [allow.publicApiKey(), allow.guest(), allow.authenticated()])
    .handler(a.handler.function(getHomepage)),

  productAvailability: a
    .query()
    .arguments({ ids: a.string().array().required() })
    .returns(a.ref('ProductAvailability').array())
    .authorization((allow) => [allow.publicApiKey(), allow.guest(), allow.authenticated()])
    .handler(a.handler.function(productAvailability)),

  validatePincode: a
    .query()
    .arguments({ pincode: a.string().required() })
    .returns(a.ref('PincodeValidation'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(validatePincode)),

  calculateCheckoutTotals: a
    .mutation()
    .arguments({ shippingAddressId: a.id() })
    .returns(a.ref('CheckoutTotals'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(calculateCheckoutTotals)),

  placeOrder: a
    .mutation()
    .arguments({ shippingAddressId: a.id().required() })
    .returns(a.ref('CreateOrderResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(createOrder)),

  verifyPayment: a
    .mutation()
    .arguments({
      razorpayOrderId: a.string().required(),
      razorpayPaymentId: a.string().required(),
      razorpaySignature: a.string().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(verifyPayment)),

  paymentFailed: a
    .mutation()
    .arguments({ razorpayOrderId: a.string().required() })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(paymentFailed)),

  setDefaultAddress: a
    .mutation()
    .arguments({ addressId: a.id().required() })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(setDefaultAddress)),

  listUsers: a
    .query()
    .returns(a.ref('ShopUser').array())
    .authorization((allow) => [allow.group('admin')])
    .handler(a.handler.function(listUsers)),

  getMediaUploadUrl: a
    .mutation()
    .arguments({
      filename: a.string().required(),
      contentType: a.string().required(),
      folder: a.string(),
    })
    .returns(a.ref('MediaUpload'))
    .authorization((allow) => [allow.group('admin')])
    .handler(a.handler.function(getMediaUploadUrl)),

  deleteMedia: a
    .mutation()
    .arguments({ key: a.string().required() })
    .returns(a.json())
    .authorization((allow) => [allow.group('admin')])
    .handler(a.handler.function(deleteMedia)),

  allocateProductCode: a
    .mutation()
    .returns(a.string())
    .authorization((allow) => [allow.group('admin')])
    .handler(a.handler.function(allocateProductCode)),

  catalogSeed: a
    .mutation()
    .arguments({
      jsonKey: a.string(),
      jsonBody: a.string(),
      resetCatalog: a.boolean(),
      resetOrders: a.boolean(),
      imageSource: a.string(),
    })
    .authorization((allow) => [allow.group('admin')])
    .handler(a.handler.function(catalogSeed).async()),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
