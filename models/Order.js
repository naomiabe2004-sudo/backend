const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    customerName: {
      type: String,
      trim: true,
      default: "",
    },

    customerPhone: {
      type: String,
      trim: true,
      default: "",
    },

    deliveryAddress: {
      type: String,
      trim: true,
      default: "",
    },

    paymentMethod: {
      type: String,
      default: "COD",
    },

    paymentStatus: {
      type: String,
      default: "Pending",
    },

    items: {
      type: [orderItemSchema],
      required: true,
    },

    subtotal: {
      type: Number,
      min: 0,
      default: 0,
    },

    deliveryFee: {
      type: Number,
      min: 0,
      default: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
   enum: [
  "To Pay",
  "Seller Preparing",
  "To Ship",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "To Receive",
  "Completed",
  "Cancelled",
],
      default: "To Pay",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);