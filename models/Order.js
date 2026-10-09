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

// Simulated GCash payment confirmation
router.put("/:id/pay", protect, authorize("buyer"), async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      buyer: req.user.id,
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    if (order.status !== "To Pay") {
      return res.status(400).json({
        message: "Only unpaid orders can be paid.",
      });
    }

    if (order.paymentMethod?.toLowerCase() !== "gcash") {
      return res.status(400).json({
        message: "This endpoint is for GCash orders only.",
      });
    }

    // Simulated payment only; no real money is processed.
    order.paymentStatus = "Paid";
    order.status = "To Ship";

    await order.save();

    await logAction(
      req,
      "PAYMENT_CONFIRMED",
      "Simulated GCash payment for order " + order._id
    );

    return res.json({
      message: "Simulated payment confirmed!",
      order,
    });
  } catch (err) {
    console.error("Payment confirmation error:", err);

    if (err.name === "CastError") {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    return res.status(500).json({
      message: "Could not confirm payment.",
    });
  }
});


module.exports = mongoose.model("Order", orderSchema);