const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["To Pay", "To Ship", "To Receive", "Completed", "Cancelled"],
      default: "To Pay",
    },
  },
  { timestamps: true }
);

// Update order status (seller only)
router.put("/:id/status", protect, authorize("seller"), async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "To Pay",
      "To Ship",
      "To Receive",
      "Completed",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid order status.",
      });
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        "items.seller": req.user.id,
      },
      {
        status,
      },
      {
        new: true,
      }
    );

    if (!order) {
      return res.status(404).json({
        message: "Order not found or you are not authorized to update it.",
      });
    }

    await logAction(
      req,
      "ORDER_STATUS_UPDATED",
      "Order " + order._id + " → " + status
    );

    res.json({
      message: "Order status updated successfully!",
      order,
    });
  } catch (err) {
    console.error("Update order status error:", err);

    res.status(500).json({
      message: "Server error.",
      error: err.message,
    });
  }
});
module.exports = mongoose.model("Order", orderSchema);